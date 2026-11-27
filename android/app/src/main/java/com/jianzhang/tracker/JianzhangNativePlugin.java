package com.jianzhang.tracker;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import android.provider.CalendarContract.Reminders;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.Credentials;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

@CapacitorPlugin(
    name = "JianzhangNative",
    permissions = {
        @Permission(
            alias = "calendar",
            strings = {
                Manifest.permission.READ_CALENDAR,
                Manifest.permission.WRITE_CALENDAR
            }
        )
    }
)
public class JianzhangNativePlugin extends Plugin {

    private static final String CALENDAR_ACCOUNT = "简账提醒";
    private static final MediaType JSON_MEDIA = MediaType.get("application/json; charset=utf-8");
    private final ExecutorService ioExecutor = Executors.newCachedThreadPool();

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build();

    private Uri asSyncAdapter(Uri uri) {
        return uri.buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(Calendars.ACCOUNT_NAME, CALENDAR_ACCOUNT)
            .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    private long findOrCreateLocalCalendar(ContentResolver resolver) {
        try (Cursor cursor = resolver.query(
            Calendars.CONTENT_URI,
            new String[]{Calendars._ID},
            Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=?",
            new String[]{CALENDAR_ACCOUNT, CalendarContract.ACCOUNT_TYPE_LOCAL},
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getLong(0);
            }
        }

        ContentValues values = new ContentValues();
        values.put(Calendars.ACCOUNT_NAME, CALENDAR_ACCOUNT);
        values.put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        values.put(Calendars.OWNER_ACCOUNT, CALENDAR_ACCOUNT);
        values.put(Calendars.NAME, CALENDAR_ACCOUNT);
        values.put(Calendars.CALENDAR_DISPLAY_NAME, CALENDAR_ACCOUNT);
        values.put(Calendars.CALENDAR_COLOR, 0xFF2563EB);
        values.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER);
        values.put(Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        values.put(Calendars.VISIBLE, 1);
        values.put(Calendars.SYNC_EVENTS, 1);

        Uri inserted = resolver.insert(asSyncAdapter(Calendars.CONTENT_URI), values);
        if (inserted != null) {
            return ContentUris.parseId(inserted);
        }
        throw new IllegalStateException("无法在本机创建系统日历账户");
    }

    @PluginMethod
    public void upsertCalendarReminder(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            requestPermissionForAlias("calendar", call, "calendarPermCallback");
            return;
        }
        executeUpsertCalendar(call);
    }

    @PermissionCallback
    private void calendarPermCallback(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) {
            executeUpsertCalendar(call);
        } else {
            call.reject("未授予日历读写权限");
        }
    }

    private void executeUpsertCalendar(PluginCall call) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            long calendarId = findOrCreateLocalCalendar(resolver);

            String existingId = call.getString("existingEventId", "");
            if (existingId != null && !existingId.isEmpty() && existingId.matches("\\d+")) {
                long oldId = Long.parseLong(existingId);
                resolver.delete(
                    ContentUris.withAppendedId(asSyncAdapter(Events.CONTENT_URI), oldId),
                    null,
                    null
                );
            }

            String title = call.getString("title", "会员续费提醒");
            String description = call.getString("description", "");
            Long startMillis = call.getLong("startTimeMillis", System.currentTimeMillis());
            String rrule = call.getString("rrule", "");
            JSArray remindArr = call.getArray("remindMinutes", new JSArray());

            ContentValues eventValues = new ContentValues();
            eventValues.put(Events.CALENDAR_ID, calendarId);
            eventValues.put(Events.TITLE, title);
            eventValues.put(Events.DESCRIPTION, description);
            eventValues.put(Events.DTSTART, startMillis);
            eventValues.put(Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
            eventValues.put(Events.AVAILABILITY, Events.AVAILABILITY_FREE);
            eventValues.put(Events.HAS_ALARM, 1);

            if (rrule != null && !rrule.trim().isEmpty()) {
                eventValues.put(Events.DURATION, "PT30M");
                eventValues.put(Events.RRULE, rrule.trim());
            } else {
                eventValues.put(Events.DTEND, startMillis + 30 * 60_000L);
            }

            Uri eventUri = resolver.insert(asSyncAdapter(Events.CONTENT_URI), eventValues);
            if (eventUri == null) {
                call.reject("写入系统日历事件失败");
                return;
            }
            long eventId = ContentUris.parseId(eventUri);

            if (remindArr != null) {
                for (int i = 0; i < remindArr.length(); i++) {
                    try {
                        int minutes = remindArr.getInt(i);
                        ContentValues remValues = new ContentValues();
                        remValues.put(Reminders.EVENT_ID, eventId);
                        remValues.put(Reminders.MINUTES, minutes);
                        remValues.put(Reminders.METHOD, Reminders.METHOD_ALERT);
                        resolver.insert(asSyncAdapter(Reminders.CONTENT_URI), remValues);
                    } catch (JSONException ignored) {
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("eventId", String.valueOf(eventId));
            ret.put("calendarName", CALENDAR_ACCOUNT);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("同步系统日历异常: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void removeCalendarReminder(PluginCall call) {
        String eventId = call.getString("eventId", "");
        JSObject ret = new JSObject();
        if (eventId == null || !eventId.matches("\\d+") || getPermissionState("calendar") != PermissionState.GRANTED) {
            ret.put("removed", false);
            call.resolve(ret);
            return;
        }
        try {
            long id = Long.parseLong(eventId);
            int rows = getContext().getContentResolver().delete(
                ContentUris.withAppendedId(asSyncAdapter(Events.CONTENT_URI), id),
                null,
                null
            );
            ret.put("removed", rows > 0);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("removed", false);
            call.resolve(ret);
        }
    }

    private String normalizeBaseUrl(String url, String folder) {
        String base = url.trim().replaceAll("/+$", "");
        String cleanFolder = folder.trim().replaceAll("^/+|/+$", "");
        return cleanFolder.isEmpty() ? base : base + "/" + cleanFolder;
    }

    @PluginMethod
    public void webdavUpload(PluginCall call) {
        final String url = call.getString("url", "");
        final String username = call.getString("username", "");
        final String password = call.getString("password", "");
        final String folder = call.getString("remoteFolder", "JianZhangBackup");
        final String fileName = call.getString("fileName", "jianzhang-latest.json");
        final String content = call.getString("content", "{}");

        ioExecutor.execute(() -> {
            try {
                String auth = Credentials.basic(username, password, StandardCharsets.UTF_8);
                String dirUrl = normalizeBaseUrl(url, folder) + "/";

                // 1. Ensure WebDAV directory exists via MKCOL (OkHttp natively supports WebDAV methods)
                Request mkcolReq = new Request.Builder()
                    .url(dirUrl)
                    .method("MKCOL", null)
                    .header("Authorization", auth)
                    .build();
                try (Response ignored = httpClient.newCall(mkcolReq).execute()) {
                    // 201 Created or 405 Already Exists are both valid
                } catch (Exception ignored) {
                }

                // 2. Upload JSON backup via PUT
                Request putReq = new Request.Builder()
                    .url(dirUrl + fileName)
                    .put(RequestBody.create(content, JSON_MEDIA))
                    .header("Authorization", auth)
                    .build();

                try (Response putResp = httpClient.newCall(putReq).execute()) {
                    int code = putResp.code();
                    boolean ok = putResp.isSuccessful();
                    JSObject ret = new JSObject();
                    ret.put("ok", ok);
                    ret.put("status", code);
                    ret.put("message", ok
                        ? "已成功备份至 WebDAV 云盘"
                        : (code == 401 ? "账号或应用密码错误 (HTTP 401)" : "WebDAV 返回 HTTP " + code));
                    call.resolve(ret);
                }
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("status", 0);
                ret.put("message", "连接云盘失败: " + e.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void webdavDownload(PluginCall call) {
        final String url = call.getString("url", "");
        final String username = call.getString("username", "");
        final String password = call.getString("password", "");
        final String folder = call.getString("remoteFolder", "JianZhangBackup");
        final String fileName = call.getString("fileName", "jianzhang-latest.json");

        ioExecutor.execute(() -> {
            try {
                String auth = Credentials.basic(username, password, StandardCharsets.UTF_8);
                String targetUrl = normalizeBaseUrl(url, folder) + "/" + fileName;

                Request getReq = new Request.Builder()
                    .url(targetUrl)
                    .get()
                    .header("Authorization", auth)
                    .build();

                try (Response getResp = httpClient.newCall(getReq).execute()) {
                    int code = getResp.code();
                    JSObject ret = new JSObject();
                    ResponseBody body = getResp.body();
                    if (getResp.isSuccessful() && body != null) {
                        ret.put("ok", true);
                        ret.put("status", code);
                        ret.put("content", body.string());
                    } else {
                        ret.put("ok", false);
                        ret.put("status", code);
                        ret.put("message", code == 404
                            ? "云盘目录中尚未找到备份文件"
                            : (code == 401 ? "账号或应用密码错误 (HTTP 401)" : "云盘返回 HTTP " + code));
                    }
                    call.resolve(ret);
                }
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("status", 0);
                ret.put("message", "读取云盘失败: " + e.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void checkLatestRelease(PluginCall call) {
        final String repo = call.getString("repo", "sushi342119/JianZhang");
        ioExecutor.execute(() -> {
            try {
                Request req = new Request.Builder()
                    .url("https://api.github.com/repos/" + repo + "/releases/latest")
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "JianZhang-Android-Updater")
                    .get()
                    .build();

                try (Response resp = httpClient.newCall(req).execute()) {
                    ResponseBody body = resp.body();
                    if (!resp.isSuccessful() || body == null) {
                        call.reject("查询 GitHub 版本失败 (HTTP " + resp.code() + ")");
                        return;
                    }
                    JSONObject json = new JSONObject(body.string());
                    String tagName = json.optString("tag_name", "");
                    String htmlUrl = json.optString("html_url", "https://github.com/" + repo + "/releases");
                    String notes = json.optString("body", "");
                    String apkUrl = htmlUrl;

                    JSONArray assets = json.optJSONArray("assets");
                    if (assets != null) {
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject a = assets.optJSONObject(i);
                            if (a != null && a.optString("name", "").endsWith(".apk")) {
                                apkUrl = a.optString("browser_download_url", htmlUrl);
                                break;
                            }
                        }
                    }

                    JSObject ret = new JSObject();
                    ret.put("tagName", tagName);
                    ret.put("htmlUrl", htmlUrl);
                    ret.put("downloadUrl", apkUrl);
                    ret.put("notes", notes);
                    call.resolve(ret);
                }
            } catch (Exception e) {
                call.reject("无法连接 GitHub 检查更新: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.isEmpty()) {
            call.reject("链接为空");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("打开外部浏览器失败: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateHomeWidget(PluginCall call) {
        try {
            String monthTitle = call.getString("monthTitle", "简账");
            String expenseText = call.getString("expenseText", "本月支出 ¥0.00");
            String subTitleText = call.getString("subTitleText", "");

            SharedPreferences prefs = getContext().getSharedPreferences(
                JianzhangWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            prefs.edit()
                .putString(JianzhangWidgetProvider.KEY_MONTH, monthTitle)
                .putString(JianzhangWidgetProvider.KEY_EXPENSE, expenseText)
                .putString(JianzhangWidgetProvider.KEY_SUBTITLE, subTitleText)
                .apply();

            JianzhangWidgetProvider.updateAllWidgets(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("更新桌面小组件失败: " + e.getMessage(), e);
        }
    }
}

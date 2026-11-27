package com.jianzhang.tracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class JianzhangWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "jianzhang_widget_prefs";
    public static final String KEY_MONTH = "month_title";
    public static final String KEY_EXPENSE = "expense_text";
    public static final String KEY_SUBTITLE = "subtitle_text";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateSingleWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, JianzhangWidgetProvider.class));
        if (ids != null && ids.length > 0) {
            for (int id : ids) {
                updateSingleWidget(context, manager, id);
            }
        }
    }

    private static void updateSingleWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String monthTitle = prefs.getString(KEY_MONTH, "简账 · 本月概览");
        String expenseText = prefs.getString(KEY_EXPENSE, "本月支出 ¥0.00");
        String subText = prefs.getString(KEY_SUBTITLE, "点击打开简账记录收支与会员");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.jianzhang_widget);
        views.setTextViewText(R.id.widget_month_title, monthTitle);
        views.setTextViewText(R.id.widget_expense_text, expenseText);
        views.setTextViewText(R.id.widget_subtitle_text, subText);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        manager.updateAppWidget(widgetId, views);
    }
}

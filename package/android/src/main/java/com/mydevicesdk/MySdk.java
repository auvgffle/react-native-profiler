package com.mydevicesdk;
import android.util.Log;
import android.os.AsyncTask;
import android.util.Log;
import android.provider.Settings;
import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;

public class MySdk {
    private static String appId = null;
    private static String token = null;
    private static long tokenExpiry = 0;
    private static String SERVER_BASE_URL = null;

    // Initialize SDK
    public static void init(String clientAppId, String baseUrl) {
        appId = clientAppId;
        SERVER_BASE_URL = baseUrl;
    }

    // Send data method
    public static void sendData(final Context context, final JSONObject payload) {
        if (appId == null || SERVER_BASE_URL == null) {
            Log.e("MySdk", "❌ SDK not initialized. Call MySdk.init(appId, baseUrl) first.");
            return;
        }

        new AsyncTask<Void, Void, Void>() {
            @Override
            protected Void doInBackground(Void... voids) {
                try {
                    // Get device ID
                    String deviceId = Settings.Secure.getString(
                        context.getContentResolver(),
                        Settings.Secure.ANDROID_ID
                    );

                    // Fetch new token if needed
                    long now = System.currentTimeMillis() / 1000;
                    if (token == null || now >= tokenExpiry - 30) {
                        URL url = new URL(SERVER_BASE_URL + "/get-token");
                        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setDoOutput(true);

                        JSONObject body = new JSONObject();
                        body.put("appId", appId);
                        body.put("deviceId", deviceId);

                        OutputStreamWriter out = new OutputStreamWriter(conn.getOutputStream());
                        out.write(body.toString());
                        out.flush();
                        out.close();

                        Scanner in = new Scanner(conn.getInputStream());
                        StringBuilder sb = new StringBuilder();
                        while (in.hasNext()) {
                            sb.append(in.nextLine());
                        }
                        in.close();

                        JSONObject response = new JSONObject(sb.toString());
                        token = response.getString("token");

                        String[] parts = token.split("\\.");
                        String payloadStr = new String(android.util.Base64.decode(parts[1], android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP));
                        JSONObject payloadJson = new JSONObject(payloadStr);
                        tokenExpiry = payloadJson.getLong("exp");
                    }

                    // Send event data
                    URL urlEvent = new URL(SERVER_BASE_URL + "/events");
                    HttpURLConnection connEvent = (HttpURLConnection) urlEvent.openConnection();
                    connEvent.setRequestMethod("POST");
                    connEvent.setRequestProperty("Content-Type", "application/json");
                    connEvent.setDoOutput(true);

                    JSONObject sendBody = new JSONObject();
                    sendBody.put("apiKey", token);
                    sendBody.put("payload", payload);

                    OutputStreamWriter outEvent = new OutputStreamWriter(connEvent.getOutputStream());
                    outEvent.write(sendBody.toString());
                    outEvent.flush();
                    outEvent.close();

                    Log.i("MySdk", "✅ Data sent, response code: " + connEvent.getResponseCode());

                } catch (Exception e) {
                    Log.e("MySdk", "❌ Error sending data: ", e);
                }
                return null;
            }
        }.execute();
    }
}

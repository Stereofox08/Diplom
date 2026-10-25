package kz.bytestore.shop;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class Api {
  private static final String URL_BASE = "https://mxyifzuhdojdyesussxj.supabase.co";
  private static final String KEY = "sb_publishable_PLPFNxr1mZ7nuGJBw8QAeQ_lZ9hK3WF";
  private final Store store;

  Api(Store store) {
    this.store = store;
  }

  synchronized JSONObject request(String path, JSONObject body, boolean auth) throws Exception {
    if (auth
        && store.session != null
        && store.session.optLong("expires_at") < System.currentTimeMillis() / 1000 + 45)
      refreshToken();
    try {
      return send(path, body, auth);
    } catch (Failure e) {
      if (e.status == 401 && auth && store.session != null) {
        refreshToken();
        return send(path, body, true);
      }
      throw e;
    }
  }

  private void refreshToken() throws Exception {
    JSONObject session = store.session;
    if (session == null) return;
    try {
      JSONObject next =
          send(
              "/auth/v1/token?grant_type=refresh_token",
              Store.obj("refresh_token", session.optString("refresh_token")),
              false);
      setSession(next);
    } catch (Failure e) {
      if (e.status == 400 || e.status == 401) store.saveSession(null);
      throw e;
    }
  }

  void setSession(JSONObject session) throws Exception {
    if (!session.has("expires_at"))
      session.put(
          "expires_at", System.currentTimeMillis() / 1000 + session.optLong("expires_in", 3600));
    store.saveSession(session);
  }

  JSONObject snapshot() throws Exception {
    return request("/rest/v1/rpc/store_snapshot", new JSONObject(), true);
  }

  private JSONObject send(String path, JSONObject body, boolean auth) throws Exception {
    HttpURLConnection c = (HttpURLConnection) new URL(URL_BASE + path).openConnection();
    c.setConnectTimeout(12000);
    c.setReadTimeout(15000);
    c.setInstanceFollowRedirects(false);
    c.setRequestProperty("apikey", KEY);
    c.setRequestProperty("Content-Type", "application/json");
    if (auth && store.session != null)
      c.setRequestProperty("Authorization", "Bearer " + store.session.optString("access_token"));
    try {
      if (body != null) {
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        try (java.io.OutputStream out = c.getOutputStream()) {
          out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
      }
      int status = c.getResponseCode();
      String text = "";
      InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream();
      if (stream != null)
        try (InputStream in = stream) {
          text = new String(readAll(in), StandardCharsets.UTF_8);
        }
      JSONObject result = parseResponse(text);
      if (status < 200 || status >= 300) throw new Failure(status, error(result));
      return result;
    } catch (java.io.IOException e) {
      throw new Exception(
          "Нет связи с магазином. Каталог сохранён на телефоне; проверьте интернет и повторите"
              + " действие.");
    } finally {
      c.disconnect();
    }
  }

  static JSONObject parseResponse(String text) throws org.json.JSONException {
    if (text.isEmpty()) return new JSONObject();
    Object parsed = new org.json.JSONTokener(text).nextValue();
    return parsed instanceof JSONObject ? (JSONObject) parsed : Store.obj("result", parsed);
  }

  private String error(JSONObject result) {
    String code = result.optString("code", result.optString("error_code"));
    switch (code) {
      case "invalid_credentials":
        return "Неверный e-mail или пароль.";
      case "email_not_confirmed":
        return "Подтвердите e-mail по ссылке из письма, затем войдите.";
      case "over_email_send_rate_limit":
        return "Слишком много писем. Проверьте почту и повторите позже.";
      case "email_address_invalid":
        return "Проверьте адрес электронной почты.";
      default:
        return result.optString(
            "message",
            result.optString(
                "msg",
                result.optString(
                    "error_description", "Не удалось выполнить запрос. Попробуйте ещё раз.")));
    }
  }

  static byte[] readAll(InputStream in) throws java.io.IOException {
    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int n;
    while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
    return out.toByteArray();
  }

  static final class Failure extends Exception {
    final int status;

    Failure(int status, String message) {
      super(message);
      this.status = status;
    }
  }
}

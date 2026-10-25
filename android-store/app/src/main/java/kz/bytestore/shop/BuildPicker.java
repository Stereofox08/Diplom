package kz.bytestore.shop;

import java.util.*;
import org.json.*;

final class BuildPicker {
  private static JSONObject specs(JSONObject p) {
    return p.optJSONObject("specs") == null ? new JSONObject() : p.optJSONObject("specs");
  }

  private static boolean includes(JSONArray list, String value) {
    if (list == null) return false;
    for (int i = 0; i < list.length(); i++) if (value.equals(list.optString(i))) return true;
    return false;
  }

  static List<JSONObject> pick(Store store, long budget, int purpose) {
    return pick(store.state, budget, purpose);
  }

  static List<JSONObject> pick(JSONObject snapshot, long budget, int purpose) {
    JSONArray products = snapshot.optJSONArray("products");
    if (products == null) return new ArrayList<>();
    List<JSONObject> best = new ArrayList<>();
    double bestScore = -1;
    for (int ci = 0; ci < products.length(); ci++) {
      JSONObject cpu = products.optJSONObject(ci);
      if (!available(cpu, "cpu")) continue;
      for (int mi = 0; mi < products.length(); mi++) {
        JSONObject board = products.optJSONObject(mi);
        if (!available(board, "motherboard")
            || !specs(cpu).optString("socket").equals(specs(board).optString("socket"))) continue;
        List<List<JSONObject>> choices = new ArrayList<>();
        boolean missing = false;
        for (String category : new String[] {"ram", "storage", "gpu", "psu", "case", "cooling"}) {
          List<JSONObject> list = new ArrayList<>();
          for (int i = 0; i < products.length(); i++) {
            JSONObject p = products.optJSONObject(i);
            if (!available(p, category)) continue;
            JSONObject s = specs(p);
            if (category.equals("ram")
                && (!s.optString("type").equals(specs(board).optString("ramType"))
                    || s.optInt("capacity") > specs(board).optInt("maxRam", Integer.MAX_VALUE)
                    || s.optInt("modules") > specs(board).optInt("ramSlots", 4))) continue;
            if (category.equals("cooling")
                && (!includes(s.optJSONArray("sockets"), specs(cpu).optString("socket"))
                    || s.optInt("tdpRating") < specs(cpu).optInt("tdp"))) continue;
            if (category.equals("case")
                && !includes(s.optJSONArray("formFactors"), specs(board).optString("formFactor")))
              continue;
            list.add(p);
          }
          list.sort(Comparator.comparingLong(p -> p.optLong("price")));
          if (list.isEmpty()) {
            missing = true;
            break;
          }
          choices.add(list);
        }
        if (missing) continue;
        // A bounded search over GPU, PSU, case and cooler; RAM/storage start affordable,
        // then upgrade within budget without compromising compatibility.
        for (JSONObject gpu : choices.get(2))
          for (JSONObject psu : choices.get(3))
            for (JSONObject tower : choices.get(4))
              for (JSONObject cooler : choices.get(5)) {
                if (specs(psu).optInt("wattage")
                    < Math.max(
                        specs(gpu).optInt("recommendedPsu"),
                        Math.ceil(
                            (specs(cpu).optInt("tdp") + specs(gpu).optInt("tdp") + 90) * 1.3)))
                  continue;
                if (specs(cooler).optString("type").equals("liquid")
                    && specs(cooler).optInt("radiator")
                        > radiator(specs(tower).optString("radiator"))) continue;
                if (specs(gpu).optInt("length")
                        > specs(tower).optInt("maxGpuLength", Integer.MAX_VALUE)
                    || specs(cooler).optInt("height")
                        > specs(tower).optInt("maxCoolerHeight", Integer.MAX_VALUE)
                    || !specs(psu)
                        .optString("formFactor", "ATX")
                        .equals(specs(tower).optString("psuFormFactor", "ATX"))) continue;
                for (JSONObject ram : choices.get(0))
                  for (JSONObject disk : choices.get(1)) {
                    List<JSONObject> set =
                        Arrays.asList(cpu, board, ram, disk, gpu, psu, tower, cooler);
                    long cost = 0;
                    double score = 0;
                    for (JSONObject p : set) {
                      cost += p.optLong("price");
                      double weight =
                          p.optString("categoryId").equals("gpu")
                              ? (purpose == 0 ? 3 : purpose == 2 ? 2 : 1)
                              : p.optString("categoryId").equals("cpu")
                                  ? (purpose == 2 ? 2.7 : 2)
                                  : .5;
                      score += specs(p).optDouble("score") * weight;
                    }
                    if (cost <= budget && score > bestScore) {
                      bestScore = score;
                      best = new ArrayList<>(set);
                    }
                  }
              }
      }
    }
    return best;
  }

  private static int radiator(String value) {
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(value);
    int max = 0;
    while (m.find()) max = Math.max(max, Integer.parseInt(m.group()));
    return max;
  }

  private static boolean available(JSONObject p, String category) {
    return p != null
        && category.equals(p.optString("categoryId"))
        && p.optInt("stock") > 0
        && "active".equals(p.optString("status", "active"));
  }
}

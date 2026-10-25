package kz.bytestore.shop;

import java.util.*;
import org.json.*;

/** Native counterpart of advisor.js compatibility rules. Drafts store IDs, never prices. */
final class BuildRules {
  static final String[] SLOTS = {
    "cpu",
    "motherboard",
    "gpu",
    "ram",
    "storage",
    "psu",
    "case",
    "cooler",
    "monitor",
    "keyboard",
    "mouse",
    "headset"
  };
  static final String[] LABELS = {
    "Процессор",
    "Материнская плата",
    "Видеокарта",
    "Оперативная память",
    "Накопитель",
    "Блок питания",
    "Корпус",
    "Охлаждение процессора",
    "Монитор",
    "Клавиатура",
    "Мышь",
    "Гарнитура"
  };

  static String category(String slot) {
    return slot.equals("cooler")
        ? "cooling"
        : Arrays.asList("keyboard", "mouse", "headset").contains(slot) ? "peripherals" : slot;
  }

  static JSONObject specs(JSONObject p) {
    return p == null || p.optJSONObject("specs") == null
        ? new JSONObject()
        : p.optJSONObject("specs");
  }

  static boolean contains(JSONArray a, String s) {
    if (a != null) for (int i = 0; i < a.length(); i++) if (a.optString(i).equals(s)) return true;
    return false;
  }

  static final class Check {
    final List<String> errors = new ArrayList<>(),
        warnings = new ArrayList<>(),
        notes = new ArrayList<>();
    int peak, minimum, recommended, fps;
    long total;

    boolean ok() {
      return errors.isEmpty();
    }
  }

  static Check check(Map<String, JSONObject> b) {
    Check c = new Check();
    JSONObject cpu = b.get("cpu"),
        mb = b.get("motherboard"),
        gpu = b.get("gpu"),
        ram = b.get("ram"),
        psu = b.get("psu"),
        tower = b.get("case"),
        cooler = b.get("cooler"),
        disk = b.get("storage");
    JSONObject cs = specs(cpu),
        ms = specs(mb),
        gs = specs(gpu),
        rs = specs(ram),
        ps = specs(psu),
        ts = specs(tower),
        hs = specs(cooler),
        ds = specs(disk);
    double cpuPower = cs.optDouble("tdp", 65) * (cs.optBoolean("unlocked") ? 1.35 : 1.1);
    double peak =
        cpuPower
            + gs.optDouble("tdp", 0)
            + 45
            + (hs.optString("type").equals("liquid") ? 12 : 6)
            + 10;
    c.peak = (int) Math.round(peak);
    c.minimum = (int) Math.ceil(peak * 1.05 / 50) * 50;
    c.recommended =
        (int) Math.ceil(Math.max(peak * 1.3, gs.optDouble("recommendedPsu", 0) * 1.05) / 50) * 50;
    for (JSONObject p : b.values()) c.total += p.optLong("price");
    c.fps =
        Math.min(
            Math.max(
                15,
                (int)
                    Math.round(
                        (gpu != null ? gs.optDouble("score", 0) : cs.optBoolean("igpu") ? 12 : 0)
                            * 2.05)),
            (int) Math.round(cs.optDouble("score", 20) * 2.5));
    if (cpu != null && mb != null) {
      if (!cs.optString("socket").equals(ms.optString("socket")))
        c.errors.add(
            "Сокет платы "
                + ms.optString("socket")
                + " не подходит процессору "
                + cs.optString("socket"));
      if (ms.optString("chipset").equals("H610") && cs.optDouble("score", 0) > 70)
        c.warnings.add("Для мощного процессора рекомендуем B760/Z790 вместо H610");
      if (ms.optString("chipset").equals("A620"))
        c.warnings.add("A620 ограничивает TDP и не поддерживает разгон");
    }
    if (ram != null && mb != null) {
      if (!rs.optString("type").equals(ms.optString("ramType")))
        c.errors.add(
            "Тип памяти не подходит плате: "
                + rs.optString("type")
                + " / "
                + ms.optString("ramType"));
      if (rs.optInt("modules") > ms.optInt("ramSlots"))
        c.errors.add("На плате недостаточно слотов памяти");
      if (rs.optInt("capacity") > ms.optInt("maxRam"))
        c.errors.add("Объём памяти превышает предел платы");
    }
    if (cpu != null && !cs.optBoolean("igpu") && gpu == null)
      c.errors.add("У процессора нет встроенной графики — нужна видеокарта");
    if (gpu != null && tower != null && gs.optInt("length") > ts.optInt("maxGpuLength"))
      c.errors.add("Видеокарта не помещается в корпус по длине");
    if (mb != null
        && tower != null
        && !contains(ts.optJSONArray("formFactors"), ms.optString("formFactor")))
      c.errors.add("Корпус не поддерживает формат материнской платы");
    if (cooler != null && cpu != null) {
      if (!contains(hs.optJSONArray("sockets"), cs.optString("socket")))
        c.errors.add("Охлаждение не поддерживает сокет процессора");
      if (hs.optDouble("tdpRating", 0) < cs.optDouble("tdp", 0) * .85)
        c.errors.add("Охлаждение недостаточно мощное — риск перегрева");
      else if (hs.optDouble("tdpRating", 0)
          < cs.optDouble("tdp", 0) * (cs.optBoolean("unlocked") ? 1.2 : 1.05))
        c.warnings.add("Небольшой запас мощности охлаждения");
      if (tower != null
          && hs.optString("type").equals("air")
          && hs.optInt("height") > ts.optInt("maxCoolerHeight"))
        c.errors.add("Кулер не помещается в корпус по высоте");
    }
    if (psu != null
        && tower != null
        && !ps.optString("formFactor").equals(ts.optString("psuFormFactor")))
      c.warnings.add("Формат блока питания отличается от корпуса — нужен переходник");
    if (psu != null) {
      if (ps.optInt("wattage") < c.minimum)
        c.errors.add("Недостаточная мощность БП: нужно минимум " + c.minimum + " Вт");
      else if (ps.optInt("wattage") < c.recommended)
        c.warnings.add("Рекомендуем БП от " + c.recommended + " Вт");
      if (gpu != null && gs.optInt("recommendedPsu") > ps.optInt("wattage"))
        c.warnings.add("Производитель видеокарты рекомендует более мощный БП");
    }
    if (disk != null && mb != null && ds.optString("formFactor").startsWith("M.2")) {
      if (ms.optInt("m2") < 1) c.warnings.add("У платы нет M.2 — выберите SATA-накопитель");
      if (ms.optInt("m2") < 2) c.notes.add("Расширение накопителя — через SATA");
    }
    if (gpu != null
        && tower != null
        && gs.optInt("tdp") > 280
        && ts.optString("fans").startsWith("1 "))
      c.notes.add("Добавьте корпусные вентиляторы для горячей видеокарты");
    if (ram != null
        && cpu != null
        && rs.optString("type").equals("DDR4")
        && cpu.optString("name").matches(".*(Ryzen 7 7800X3D|Ryzen 5 7600).*"))
      c.errors.add("Для AM5 требуется DDR5");
    return c;
  }
}

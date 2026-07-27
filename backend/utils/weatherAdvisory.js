const text = {
  en: {
    normalTitle: "Conditions look manageable",
    normalBody:
      "Continue routine field monitoring and check soil moisture before irrigation.",
    heatTitle: "High heat risk",
    heatBody:
      "Irrigate during early morning or evening, use mulch and protect workers from afternoon heat.",
    rainTitle: "Heavy rain expected",
    rainBody:
      "Clear drainage channels, secure stored produce and postpone spraying before rain.",
    fungusTitle: "Fungal disease risk",
    fungusBody:
      "High humidity and rain can increase fungal pressure. Inspect leaves and improve airflow.",
    windTitle: "Strong wind risk",
    windBody:
      "Avoid pesticide spraying and secure light equipment, nursery covers and stacked produce.",
    coldTitle: "Cold or frost risk",
    coldBody:
      "Protect sensitive seedlings, use light irrigation where locally recommended and monitor frost.",
    sprayTitle: "Spraying window is unsafe",
    sprayBody:
      "Rain or strong wind can reduce spray effectiveness. Wait for calmer and drier conditions.",
    rice: "Rice and maize conditions may be suitable where soil drainage and local sowing windows permit.",
    wheat: "Wheat, mustard and pulses may suit the current cool-season window; verify local variety timing.",
    vegetables: "Short-duration vegetables may be considered with irrigation and market access.",
    disclaimer:
      "Decision support only. Confirm crop, chemical and irrigation actions with a local agriculture expert.",
  },
  hi: {
    normalTitle: "मौसम सामान्य प्रबंधन योग्य है",
    normalBody:
      "नियमित खेत निगरानी जारी रखें और सिंचाई से पहले मिट्टी की नमी जाँचें।",
    heatTitle: "अधिक गर्मी का जोखिम",
    heatBody:
      "सुबह या शाम सिंचाई करें, मल्च का उपयोग करें और दोपहर की गर्मी से श्रमिकों को बचाएँ।",
    rainTitle: "भारी बारिश की संभावना",
    rainBody:
      "जल निकासी साफ रखें, भंडारित उपज सुरक्षित करें और बारिश से पहले छिड़काव टालें।",
    fungusTitle: "फफूंद रोग का जोखिम",
    fungusBody:
      "अधिक नमी और बारिश से फफूंद बढ़ सकती है। पत्तियों की जाँच और हवा का प्रवाह बेहतर करें।",
    windTitle: "तेज हवा का जोखिम",
    windBody:
      "कीटनाशक छिड़काव रोकें और हल्के उपकरण, नर्सरी कवर तथा उपज सुरक्षित करें।",
    coldTitle: "ठंड या पाला जोखिम",
    coldBody:
      "संवेदनशील पौधों को ढकें और स्थानीय सलाह के अनुसार पाला प्रबंधन करें।",
    sprayTitle: "छिड़काव का समय सुरक्षित नहीं",
    sprayBody:
      "बारिश या तेज हवा से छिड़काव का असर घट सकता है। शांत और सूखे मौसम की प्रतीक्षा करें।",
    rice: "स्थानीय बुवाई समय और जल निकासी के अनुसार धान या मक्का उपयुक्त हो सकते हैं।",
    wheat: "ठंडे मौसम में गेहूँ, सरसों और दलहन पर विचार करें; स्थानीय किस्म का समय जाँचें।",
    vegetables: "सिंचाई और बाजार उपलब्ध होने पर कम अवधि की सब्जियों पर विचार किया जा सकता है।",
    disclaimer:
      "यह केवल निर्णय सहायता है। फसल, रसायन और सिंचाई संबंधी कदम स्थानीय कृषि विशेषज्ञ से जाँचें।",
  },
};

const round = (value) =>
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(1)) : null;

export const buildWeatherAdvisory = (weather, language = "en") => {
  const dictionary = text[language] || text.en;
  const current = weather.current || {};
  const daily = weather.daily || {};
  const temperature = Number(current.temperature_2m);
  const humidity = Number(current.relative_humidity_2m);
  const wind = Number(current.wind_speed_10m);
  const rainNow = Number(current.precipitation || 0);
  const rainfall = (daily.precipitation_sum || [])
    .slice(0, 3)
    .reduce((sum, value) => sum + Number(value || 0), 0);
  const maxTemperature = Math.max(
    temperature || -100,
    ...(daily.temperature_2m_max || []).slice(0, 3).map(Number)
  );
  const minTemperature = Math.min(
    temperature || 100,
    ...(daily.temperature_2m_min || []).slice(0, 3).map(Number)
  );

  const alerts = [];
  if (maxTemperature >= 35) {
    alerts.push({ level: "high", title: dictionary.heatTitle, body: dictionary.heatBody });
  }
  if (rainfall >= 30) {
    alerts.push({ level: "high", title: dictionary.rainTitle, body: dictionary.rainBody });
  }
  if (humidity >= 80 && (rainNow > 0 || rainfall >= 10)) {
    alerts.push({ level: "medium", title: dictionary.fungusTitle, body: dictionary.fungusBody });
  }
  if (wind >= 25) {
    alerts.push({ level: "medium", title: dictionary.windTitle, body: dictionary.windBody });
  }
  if (minTemperature <= 8) {
    alerts.push({ level: "high", title: dictionary.coldTitle, body: dictionary.coldBody });
  }
  if (wind >= 15 || rainNow > 0 || rainfall >= 8) {
    alerts.push({ level: "medium", title: dictionary.sprayTitle, body: dictionary.sprayBody });
  }
  if (!alerts.length) {
    alerts.push({ level: "low", title: dictionary.normalTitle, body: dictionary.normalBody });
  }

  const month = new Date().getMonth() + 1;
  let cropSuggestion = dictionary.vegetables;
  if ([6, 7, 8, 9, 10].includes(month) && rainfall >= 10) {
    cropSuggestion = dictionary.rice;
  } else if ([11, 12, 1, 2].includes(month) && maxTemperature < 32) {
    cropSuggestion = dictionary.wheat;
  }

  return {
    summary: {
      temperature_c: round(temperature),
      humidity_percent: round(humidity),
      wind_kmh: round(wind),
      precipitation_mm: round(rainNow),
      next_3_days_rain_mm: round(rainfall),
      min_temperature_c: round(minTemperature),
      max_temperature_c: round(maxTemperature),
    },
    alerts,
    crop_suggestion: cropSuggestion,
    disclaimer: dictionary.disclaimer,
  };
};

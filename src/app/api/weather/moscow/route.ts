import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOSCOW_LAT = 55.7558;
const MOSCOW_LON = 37.6173;

type YandexForecastResponse = {
  fact?: {
    temp?: number;
    wind_speed?: number;
    condition?: string;
  };
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

type CustomWeatherResponse = {
  timezone?: string;
  units?: string;
  current?: {
    icon_num?: number;
    weather?: string;
    temperature?: number;
    wind?: {
      speed?: number;
      gusts?: number;
      angle?: number;
      dir?: string;
    };
  };
};

type WeatherPayload = {
  city: string;
  tempC: number | null;
  windMs: number | null;
  condition: string | null;
  source: "custom-weather-api" | "yandex-api" | "yandex-page" | "open-meteo";
};

function parseFirstNumber(input: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1] !== undefined) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function parseFirstString(input: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

async function getFromYandexApi(apiKey: string): Promise<WeatherPayload | null> {
  const yandexUrl = `https://api.weather.yandex.ru/v2/forecast?lat=${MOSCOW_LAT}&lon=${MOSCOW_LON}&lang=en_US&limit=1&hours=false&extra=false`;
  const res = await fetch(yandexUrl, {
    headers: {
      "X-Yandex-Weather-Key": apiKey,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as YandexForecastResponse;
  return {
    city: "Moscow",
    tempC: typeof json.fact?.temp === "number" ? json.fact.temp : null,
    windMs: typeof json.fact?.wind_speed === "number" ? json.fact.wind_speed : null,
    condition: typeof json.fact?.condition === "string" ? json.fact.condition : null,
    source: "yandex-api",
  };
}

async function getFromYandexPage(): Promise<WeatherPayload | null> {
  const pageUrl = "https://yandex.ru/pogoda/ru/moscow";
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const html = await res.text();
  if (!html) return null;

  const tempC = parseFirstNumber(html, [
    /"temp"\s*:\s*(-?\d{1,2})/i,
    /"temperature"\s*:\s*(-?\d{1,2})/i,
    /(-?\d{1,2})\s*°C/i,
    /temp__value[^>]*>(-?\d{1,2})</i,
  ]);

  const windMs = parseFirstNumber(html, [
    /"wind_speed"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"windSpeed"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /([0-9]+(?:\.[0-9]+)?)\s*(?:m\/s|м\/с)/i,
  ]);

  const condition = parseFirstString(html, [
    /"condition"\s*:\s*"([a-z\-]+)"/i,
    /"weather_type"\s*:\s*"([a-z\-]+)"/i,
  ]);

  if (tempC === null && windMs === null && !condition) return null;

  return {
    city: "Moscow",
    tempC,
    windMs,
    condition,
    source: "yandex-page",
  };
}

function mapCustomCondition(input: string | undefined): string | null {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("thunder")) return "thunderstorm";
  if (normalized.includes("snow")) return "snow";
  if (normalized.includes("rain") || normalized.includes("drizzle")) return "rain";
  if (normalized.includes("partly")) return "partly-cloudy";
  if (normalized.includes("clear") || normalized.includes("sunny")) return "clear";
  if (normalized.includes("cloud") || normalized.includes("overcast")) return "cloudy";
  return normalized.replace(/\s+/g, "-");
}

async function getFromCustomWeatherApi(apiUrl: string, apiKey?: string): Promise<WeatherPayload | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      place_id: "moscow",
      language: "en",
      unit: "metric",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as CustomWeatherResponse;
  const tempC = typeof json.current?.temperature === "number" ? json.current.temperature : null;
  const windMs = typeof json.current?.wind?.speed === "number" ? json.current.wind.speed : null;
  const condition = mapCustomCondition(json.current?.weather);

  if (tempC === null && windMs === null && !condition) return null;

  return {
    city: "Moscow",
    tempC,
    windMs,
    condition,
    source: "custom-weather-api",
  };
}

function mapOpenMeteoCode(conditionCode: number | undefined): string | null {
  if (typeof conditionCode !== "number") return null;

  if (conditionCode === 0) return "clear";
  if (conditionCode === 1 || conditionCode === 2) return "partly-cloudy";
  if (conditionCode === 3) return "overcast";
  if (conditionCode === 45 || conditionCode === 48) return "fog";
  if (conditionCode >= 51 && conditionCode <= 67) return "rain";
  if (conditionCode >= 71 && conditionCode <= 77) return "snow";
  if (conditionCode >= 80 && conditionCode <= 82) return "showers";
  if (conditionCode >= 85 && conditionCode <= 86) return "snow";
  if (conditionCode >= 95 && conditionCode <= 99) return "thunderstorm";
  return "cloudy";
}

async function getFromOpenMeteo(): Promise<WeatherPayload | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${MOSCOW_LAT}&longitude=${MOSCOW_LON}` +
    "&current=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=ms&timezone=Europe%2FMoscow";

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as OpenMeteoResponse;
  const tempC = typeof json.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
  const windMs = typeof json.current?.wind_speed_10m === "number" ? json.current.wind_speed_10m : null;
  const condition = mapOpenMeteoCode(json.current?.weather_code);

  if (tempC === null && windMs === null && !condition) return null;

  return {
    city: "Moscow",
    tempC,
    windMs,
    condition,
    source: "open-meteo",
  };
}

export async function GET() {
  try {
    const customWeatherApiUrl = process.env.WEATHER_API_URL;
    const customWeatherApiKey = process.env.WEATHER_API_KEY;
    const apiKey = process.env.YANDEX_WEATHER_API_KEY;
    let payload: WeatherPayload | null = null;

    if (customWeatherApiUrl) payload = await getFromCustomWeatherApi(customWeatherApiUrl, customWeatherApiKey);
    if (!payload && apiKey) payload = await getFromYandexApi(apiKey);
    if (!payload) payload = await getFromYandexPage();
    if (!payload) payload = await getFromOpenMeteo();
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Weather unavailable from all providers." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      data: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

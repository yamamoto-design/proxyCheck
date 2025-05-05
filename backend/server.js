const express = require("express");
const fs = require("fs");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const results = [];

const inputFile = path.join(__dirname, "Denton.txt");

async function getExitIP(proxyStr) {
  const [host, port, username, password] = proxyStr.split(":");
  const proxyUrl = `http://${username}:${password}@${host}:${port}`;

  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const res = await axios.get("https://api.ipify.org?format=json", {
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });
    return res.data.ip;
  } catch (err) {
    console.warn(` Failed IP check for ${proxyStr}: ${err.message}`);
    return null;
  }
}

async function getCountryAndRegion(ip) {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`);
    const country = res.data.country || "UNKNOWN";
    const region = res.data.regionName || "UNKNOWN";
    return { country, region };
  } catch (err) {
    console.warn(` Failed country/region lookup for IP ${ip}: ${err.message}`);
    return { country: "UNKNOWN", region: "UNKNOWN" };
  }
}

async function processProxies() {
  const lines = fs.readFileSync(inputFile, "utf-8").split("\n").filter(Boolean);

  for (const line of lines) {
    const proxy = line.trim();
    console.log(`Testing: ${proxy}`);

    const ip = await getExitIP(proxy);
    if (!ip) {
      results.push({
        proxy: proxy,
        ip: "UNKNOWN",
        country: "UNKNOWN",
        region: "UNKNOWN",
      });
      continue;
    }

    const { country, region } = await getCountryAndRegion(ip);
    console.log(` ${proxy} => ${ip} => ${country}, ${region}`);
    let index = results.findIndex((p) => p.proxy === proxy);
    if (index === -1) {
      results.push({
        proxy: proxy,
        ip: ip,
        country: country,
        region: region,
      });
    } else {
      results[index] = {
        proxy: proxy,
        ip: ip,
        country: country,
        region: region,
      };
    }
    if (results.length === lines.length - 1) {
      setTimeout(() => {
        processProxies();
      }, 50000);
    }

    console.log(`\n Done! Results saved to results.json`);
  }
}

app.post("/api/check-proxy", async (req, res) => {
  console.log("Received request:", req.body);
  const { country } = req.body;
  if (!country) {
    return res.status(400).json({ error: "country is required" });
  }
  console.log("country:", country);
  console.log("results:", results);

  let filterArrey = results.filter(
    (p) =>
      p.country.toLowerCase().includes(country.toLowerCase()) ||
      p.region.toLowerCase().includes(country.toLowerCase())
  );
  console.log("filterArrey:", filterArrey);

  return res.status(200).json({ data: filterArrey });
});

app.listen(PORT, () => {
  processProxies();
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

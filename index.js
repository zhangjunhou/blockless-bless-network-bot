const fs = require('fs').promises;
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const readline = require('readline');
const config = require('./config');

const apiBaseUrl = "https://gateway-run.bls.dev/api/v1";
let useProxy;
const MAX_PING_ERRORS = 3;
const pingInterval = 120000;
const restartDelay = 240000;
const processRestartDelay = 150000;
const retryDelay = 150000;
const hardwareInfoFile = path.join(__dirname, 'hardwareInfo.json');

async function loadFetch() {
    const fetch = await import('node-fetch').then(module => module.default);
    return fetch;
}

async function promptUseProxy() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question('Do you want to use a proxy? (y/n): ', answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

const commonHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

async function fetchIpAddress(fetch, agent = null) {
    const primaryUrl = "https://ip-check.bless.network/";
    const fallbackUrl = "https://api.ipify.org?format=json";

    try {
        const response = await fetch(primaryUrl, { agent, headers: commonHeaders });
        const data = await response.json();
        console.log(`[${new Date().toISOString()}] IP fetch response from primary URL:`, data);
        return data.ip;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Failed to fetch IP address from primary URL: ${error.message}`);
        console.log(`[${new Date().toISOString()}] Attempting to fetch IP address from fallback URL...`);

        try {
            const response = await fetch(fallbackUrl, { agent, headers: commonHeaders });
            const data = await response.json();
            console.log(`[${new Date().toISOString()}] IP fetch response from fallback URL:`, data);
            return data.ip;
        } catch (fallbackError) {
            console.error(`[${new Date().toISOString()}] Failed to fetch IP address from fallback URL: ${fallbackError.message}`);
            return null;
        }
    }
}

function generateRandomHardwareInfo() {
    const cpuModels = [
        "AMD Ryzen 9 5900HS", "Intel Core i7-10700K", "AMD Ryzen 5 3600",
        "Intel Core i9-10900K", "AMD Ryzen 7 3700X", "Intel Core i5-10600K",
        "AMD Ryzen 3 3300X", "Intel Core i3-10100", "AMD Ryzen 7 5800X",
        "Intel Core i5-11600K", "AMD Ryzen 5 5600X", "Intel Core i3-10320",
        "AMD Ryzen 3 3100", "Intel Core i9-9900K", "AMD Ryzen 9 3900X",
        "Intel Core i7-9700K", "AMD Ryzen 7 2700X", "Intel Core i5-9600K",
        "AMD Ryzen 5 2600", "Intel Core i3-9100", "AMD Ryzen 3 2200G",
        "Intel Core i9-11900K", "AMD Ryzen 9 5950X", "Intel Core i7-11700K",
        "AMD Ryzen 5 4500U", "Intel Core i7-10750H", "AMD Ryzen 7 4800H",
        "Intel Core i5-10210U", "AMD Ryzen 3 4300U", "Intel Core i3-1005G1",
        "AMD Ryzen 9 4900HS", "Intel Core i9-10850K", "AMD Ryzen 9 3950X",
        "Intel Core i7-10700", "AMD Ryzen 7 3700U", "Intel Core i5-10400",
        "AMD Ryzen 5 3550H", "Intel Core i3-10100F", "AMD Ryzen 3 3200G",
        "Intel Core i9-9900KS", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-9750H", "AMD Ryzen 5 4600H",
        "Intel Core i9-10940X", "AMD Ryzen 7 2700", "Intel Core i5-9400F",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400",
        "AMD Ryzen 3 1200", "Intel Core i3-8100", "AMD Ryzen 9 5900X",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i7-10710U", "AMD Ryzen 7 2700E",
        "Intel Core i5-9500", "AMD Ryzen 5 3400G", "Intel Core i3-8300",
        "AMD Ryzen 3 1300X", "Intel Core i9-10980HK", "AMD Ryzen 5 3600X",
        "Intel Core i7-10700F", "AMD Ryzen 7 2700", "Intel Core i5-9400"
    ];
    const cpuFeatures = ["mmx", "sse", "sse2", "sse3", "ssse3", "sse4_1", "sse4_2", "avx"];
    return {
        cpuArchitecture: "x86_64",
        cpuModel: cpuModels[Math.floor(Math.random() * cpuModels.length)],
        cpuFeatures: cpuFeatures.slice(0, Math.floor(Math.random() * cpuFeatures.length) + 1),
        numOfProcessors: Math.floor(Math.random() * 8) + 4,
        totalMemory: Math.floor(Math.random() * (128 - 8 + 1) + 8) * 1024 * 1024 * 1024
    };
}

async function loadHardwareInfo() {
    try {
        const data = await fs.readFile(hardwareInfoFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function saveHardwareInfo(hardwareInfo) {
    await fs.writeFile(hardwareInfoFile, JSON.stringify(hardwareInfo, null, 2));
}

async function registerNode(nodeId, hardwareId,hardwareInfo, ipAddress, agent, authToken) {
    const fetch = await loadFetch();
    const registerUrl = `${apiBaseUrl}/nodes/${nodeId}`;
    console.log(`[${new Date().toISOString()}] Registering node with IP: ${ipAddress}, Hardware ID: ${hardwareId}`);

    // let hardwareInfo = await loadHardwareInfo();
    // if (!hardwareInfo[nodeId]) {
    //     hardwareInfo[nodeId] = generateRandomHardwareInfo();
    //     await saveHardwareInfo(hardwareInfo);
    // }

    const response = await fetch(registerUrl, {
        method: "POST",
        headers: {
            ...commonHeaders,
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
            ipAddress,
            hardwareId,
            hardwareInfo: hardwareInfo,
            extensionVersion: "0.1.7"
        }),
        agent
    });

    try {
        const data = await response.json();
        console.log(`[${new Date().toISOString()}] Registration response:`, data);
        return data;
    } catch (error) {
        const text = await response.text();
        console.error(`[${new Date().toISOString()}] Failed to parse JSON. Response text:`, text);
        throw new Error(`Invalid JSON response: ${text}`);
    }
}

async function startSession(nodeId, agent, authToken) {
    const fetch = await loadFetch();
    const startSessionUrl = `${apiBaseUrl}/nodes/${nodeId}/start-session`;
    console.log(`[${new Date().toISOString()}] Starting session for node ${nodeId}, it might take a while...`);
    const response = await fetch(startSessionUrl, {
        method: "POST",
        headers: {
            ...commonHeaders,
            Authorization: `Bearer ${authToken}`
        },
        agent
    });

    try {
        const data = await response.json();
        console.log(`[${new Date().toISOString()}] Start session response:`, data);
        return data;
    } catch (error) {
        const text = await response.text();
        console.error(`[${new Date().toISOString()}] Failed to parse JSON. Response text:`, text);
        throw new Error(`Invalid JSON response: ${text}`);
    }
}

async function pingNode(nodeId, agent, ipAddress, authToken, pingErrorCount) {
    const fetch = await loadFetch();
    const chalk = await import('chalk');
    const pingUrl = `${apiBaseUrl}/nodes/${nodeId}/ping`;

    const proxyInfo = agent ? JSON.stringify(agent.proxy) : 'No proxy';

    console.log(`[${new Date().toISOString()}] Pinging node ${nodeId} using proxy ${proxyInfo}`);
    const response = await fetch(pingUrl, {
        method: "POST",
        headers: {
            ...commonHeaders,
            Authorization: `Bearer ${authToken}`
        },
        agent
    });

    try {
        const data = await response.json();
        if (!data.status) {
            console.log(
                `[${new Date().toISOString()}] ${chalk.default.green('First time ping initiate')}, NodeID: ${chalk.default.cyan(nodeId)}, Proxy: ${chalk.default.yellow(proxyInfo)}, IP: ${chalk.default.yellow(ipAddress)}`
            );
        } else {
            let statusColor = data.status.toLowerCase() === 'ok' ? chalk.default.green : chalk.default.red;
            const logMessage = `[${new Date().toISOString()}] Ping response status: ${statusColor(data.status.toUpperCase())}, NodeID: ${chalk.default.cyan(nodeId)}, Proxy: ${chalk.default.yellow(proxyInfo)}, IP: ${chalk.default.yellow(ipAddress)}`;
            console.log(logMessage);
        }
        pingErrorCount[nodeId] = 0;
        return data;
    } catch (error) {
        const text = await response.text();
        console.error(`[${new Date().toISOString()}] Failed to parse JSON. Response text:`, text);
        pingErrorCount[node.nodeId] = (pingErrorCount[node.nodeId] || 0) + 1;
        throw new Error(`Invalid JSON response: ${text}`);
    }
}

async function displayHeader() {
    const chalk = await import('chalk');
    console.log("");
    console.log(chalk.default.yellow(" ============================================"));
    console.log(chalk.default.yellow("|        Blockless Bless Network Bot         |"));
    console.log(chalk.default.yellow("|         github.com/recitativonika          |"));
    console.log(chalk.default.yellow(" ============================================"));
    console.log("");
}

const activeNodes = new Set();
const nodeIntervals = new Map();

async function processNode(node, agent, ipAddress, authToken) {
    const pingErrorCount = {};
    let intervalId = null;

    while (true) {
        try {
            if (activeNodes.has(node.nodeId)) {
                console.log(`[${new Date().toISOString()}] Node ${node.nodeId} is already being processed.`);
                return;
            }

            activeNodes.add(node.nodeId);
            console.log(`[${new Date().toISOString()}] Processing nodeId: ${node.nodeId}, hardwareId: ${node.hardwareId}, IP: ${ipAddress}`);

            const registrationResponse = await registerNode(node.nodeId, node.hardwareId,node.hardwareInfo, ipAddress, agent, authToken);
            console.log(`[${new Date().toISOString()}] Node registration completed for nodeId: ${node.nodeId}. Response:`, registrationResponse);

            const startSessionResponse = await startSession(node.nodeId, agent, authToken);
            console.log(`[${new Date().toISOString()}] Session started for nodeId: ${node.nodeId}. Response:`, startSessionResponse);

            console.log(`[${new Date().toISOString()}] Sending initial ping for nodeId: ${node.nodeId}`);
            await pingNode(node.nodeId, agent, ipAddress, authToken, pingErrorCount);

            if (!nodeIntervals.has(node.nodeId)) {
                intervalId = setInterval(async () => {
                    try {
                        console.log(`[${new Date().toISOString()}] Sending ping for nodeId: ${node.nodeId}`);
                        await pingNode(node.nodeId, agent, ipAddress, authToken, pingErrorCount);
                    } catch (error) {
                        console.error(`[${new Date().toISOString()}] Error during ping: ${error.message}`);

                        pingErrorCount[node.nodeId] = (pingErrorCount[node.nodeId] || 0) + 1;
                        if (pingErrorCount[node.nodeId] >= MAX_PING_ERRORS) {
                            clearInterval(nodeIntervals.get(node.nodeId));
                            nodeIntervals.delete(node.nodeId);
                            activeNodes.delete(node.nodeId);
                            console.error(`[${new Date().toISOString()}] Ping failed ${MAX_PING_ERRORS} times consecutively for nodeId: ${node.nodeId}. Restarting process...`);
                            await new Promise(resolve => setTimeout(resolve, processRestartDelay));
                            await processNode(node, agent, ipAddress, authToken);
                        }
                    }
                }, pingInterval);
                nodeIntervals.set(node.nodeId, intervalId);
            }

            break;

        } catch (error) {
            if (error.message.includes('proxy') || error.message.includes('connect') || error.message.includes('authenticate')) {
                console.error(`[${new Date().toISOString()}] Proxy error for nodeId: ${node.nodeId}, retrying in 15 minutes: ${error.message}`);
                setTimeout(() => processNode(node, agent, ipAddress, authToken), retryDelay);
            } else {
                console.error(`[${new Date().toISOString()}] Error occurred for nodeId: ${node.nodeId}, restarting process in 50 seconds: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, restartDelay));
            }
        } finally {
            activeNodes.delete(node.nodeId);
        }
    }
}

async function runAll(initialRun = true) {
    try {
        if (initialRun) {
            await displayHeader();
            useProxy = await promptUseProxy();
        }

        const fetch = await loadFetch();
        const publicIpAddress = useProxy ? null : await fetchIpAddress(fetch);

        // let hardwareInfo = await loadHardwareInfo();

        // config.forEach(user => {
        //     user.nodes.forEach(node => {
        //         if (!hardwareInfo[node.nodeId]) {
        //             hardwareInfo[node.nodeId] = generateRandomHardwareInfo();
        //         }
        //     });
        // });

        // await saveHardwareInfo(hardwareInfo);

        const nodePromises = config.flatMap(user =>
            user.nodes.map(async node => {
                let agent = null;
                if (useProxy && node.proxy) {
                    if (node.proxy.startsWith('socks')) {
                        agent = new SocksProxyAgent(node.proxy);
                    } else {
                        const proxyUrl = node.proxy.startsWith('http') ? node.proxy : `http://${node.proxy}`;
                        agent = new HttpsProxyAgent(proxyUrl);
                    }
                }
                let ipAddress = useProxy ? await fetchIpAddress(fetch, agent) : publicIpAddress;

                if (ipAddress) {
                    await processNode(node, agent, ipAddress, user.usertoken).catch(error => {
                        console.error(`[${new Date().toISOString()}] Error processing node ${node.nodeId}: ${error.message}`);
                    });
                } else {
                    console.error(`[${new Date().toISOString()}] Skipping node ${node.nodeId} due to IP fetch failure. Retrying in 15 minutes.`);
                    setTimeout(async () => {
                        ipAddress = await fetchIpAddress(fetch, agent);
                        if (ipAddress) {
                            await processNode(node, agent, ipAddress, user.usertoken);
                        } else {
                            console.error(`[${new Date().toISOString()}] Failed to fetch IP address again for node ${node.nodeId}.`);
                        }
                    }, retryDelay);
                }
            })
        );

        await Promise.allSettled(nodePromises);
    } catch (error) {
        const chalk = await import('chalk');
        console.error(chalk.default.yellow(`[${new Date().toISOString()}] An error occurred: ${error.message}`));
    }
}

process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception: ${error.message}`);
    runAll(false);
});

runAll();

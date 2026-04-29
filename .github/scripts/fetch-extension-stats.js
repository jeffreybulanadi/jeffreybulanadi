const https = require('https');
const fs = require('fs');
const path = require('path');

const BADGES_DIR = path.resolve(__dirname, '../../badges');

const EXTENSIONS = [
  {
    id: 'jeffreybulanadi.bc-docker-manager',
    slug: 'bc-docker-manager',
    versionColor: '0078d7',
    installColor: '63ba83',
  },
  {
    id: 'jeffreybulanadi.al-indent-prism',
    slug: 'al-indent-prism',
    versionColor: '0066CC',
    installColor: '63ba83',
  },
  {
    id: 'jeffreybulanadi.vscodeaquarium',
    slug: 'vscodeaquarium',
    versionColor: '00ACC1',
    installColor: '63ba83',
  },
];

function queryMarketplace(extensionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
      flags: 769, // IncludeVersions(1) | IncludeStatistics(256) | IncludeLatestVersionOnly(512)
    });

    const req = https.request(
      {
        hostname: 'marketplace.visualstudio.com',
        path: '/_apis/public/gallery/extensionquery',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json;api-version=3.0-preview.1',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'Mozilla/5.0 (compatible; GitHubActions/badge-updater)',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Marketplace API returned HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Failed to parse Marketplace response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function writeBadge(filePath, label, message, color) {
  const content = JSON.stringify({ schemaVersion: 1, label, message, color }, null, 2);
  fs.writeFileSync(filePath, content + '\n');
}

(async () => {
  fs.mkdirSync(BADGES_DIR, { recursive: true });

  let hasError = false;

  for (const ext of EXTENSIONS) {
    try {
      const data = await queryMarketplace(ext.id);
      const extension = data.results?.[0]?.extensions?.[0];

      if (!extension) {
        throw new Error(`Extension not found in response: ${ext.id}`);
      }

      const version = extension.versions?.[0]?.version ?? 'unknown';

      const statsMap = {};
      for (const s of extension.statistics ?? []) {
        statsMap[s.statisticName] = s.value;
      }

      const installs = Math.round(statsMap.install ?? 0);
      const avgRating = statsMap.averagerating != null
        ? Number(statsMap.averagerating).toFixed(1)
        : '0.0';
      const ratingCount = Math.round(statsMap.ratingcount ?? 0);

      writeBadge(
        path.join(BADGES_DIR, `${ext.slug}-version.json`),
        'version',
        `v${version}`,
        ext.versionColor
      );
      writeBadge(
        path.join(BADGES_DIR, `${ext.slug}-installs.json`),
        'installs',
        installs.toLocaleString(),
        ext.installColor
      );
      writeBadge(
        path.join(BADGES_DIR, `${ext.slug}-rating.json`),
        'rating',
        `${avgRating}/5 (${ratingCount})`,
        'FFD700'
      );

      console.log(`${ext.id}: v${version}, ${installs} installs, ${avgRating}/5 (${ratingCount} ratings)`);
    } catch (err) {
      console.error(`ERROR fetching stats for ${ext.id}: ${err.message}`);
      console.error('Existing badge files will be preserved.');
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  }

  console.log('All badge JSON files updated.');
})();

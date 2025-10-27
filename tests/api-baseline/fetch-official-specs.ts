#!/usr/bin/env ts-node
/**
 * Fetches official Deepgram Voice Agent v1 API spec
 * Source: github.com/deepgram/deepgram-api-specs/asyncapi.yml
 */

import https from 'https';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const SPECS_URL = 'https://raw.githubusercontent.com/deepgram/deepgram-api-specs/main/asyncapi.yml';

async function fetch(url: string): Promise<{ text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ text: () => Promise.resolve(data) });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchOfficialSpec() {
  console.log('📥 Fetching official Deepgram Voice Agent API spec...');
  
  const response = await fetch(SPECS_URL);
  const asyncApiYaml = await response.text();
  const spec = yaml.load(asyncApiYaml) as any;
  
  // Extract Voice Agent server events (messages from server to client)
  const serverEvents = extractServerEvents(spec);
  
  console.log(`✅ Found ${serverEvents.length} official Voice Agent events`);
  console.log('Events:', serverEvents.join(', '));
  
  // Generate TypeScript baseline
  generateBaselineFile(serverEvents);
  
  // Copy full spec for reference
  copyFullSpec(asyncApiYaml);
}

function extractServerEvents(spec: any): string[] {
  const events: string[] = [];
  const channels = spec.channels || {};
  
  for (const [channelPath, channel] of Object.entries(channels)) {
    if (channelPath.includes('/agent') || channelPath.includes('converse')) {
      // Extract server->client messages (subscribe)
      const subscribe = (channel as any).subscribe;
      if (subscribe?.message?.oneOf) {
        for (const msg of subscribe.message.oneOf) {
          if (msg.$ref) {
            // Extract event name from reference
            const eventName = msg.$ref.split('/').pop();
            events.push(eventName);
          }
        }
      }
    }
  }
  
  return events;
}

function generateBaselineFile(events: string[]) {
  const content = `/**
 * AUTO-GENERATED from github.com/deepgram/deepgram-api-specs
 * DO NOT EDIT MANUALLY
 * 
 * Official Deepgram Voice Agent v1 API server events
 * Source: https://github.com/deepgram/deepgram-api-specs/blob/main/asyncapi.yml
 * 
 * These are events sent FROM Deepgram server TO client
 */

export const OFFICIAL_DEEPGRAM_SERVER_EVENTS = [
${events.map(e => `  '${e}',`).join('\n')}
] as const;

export type OfficialDeepgramEvent = typeof OFFICIAL_DEEPGRAM_SERVER_EVENTS[number];
`;

  const outPath = path.join(__dirname, 'official-deepgram-api.ts');
  fs.writeFileSync(outPath, content);
  console.log(`✅ Generated baseline: ${outPath}`);
}

function copyFullSpec(yaml: string) {
  const outPath = path.join(__dirname, 'asyncapi.yml');
  fs.writeFileSync(outPath, yaml);
  console.log(`✅ Saved full spec: ${outPath}`);
}

fetchOfficialSpec().catch(console.error);


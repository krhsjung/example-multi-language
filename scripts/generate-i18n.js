#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// JSONC 파싱 (주석 제거, 값만 반환)
function parseJsonc(content) {
  const withoutLineComments = content.replace(/^\s*\/\/.*$/gm, '');
  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutTrailingComments = withoutBlockComments.replace(/,(\s*)\/\/.*$/gm, ',$1');
  const withoutInlineComments = withoutTrailingComments.replace(/(["\d\w])(\s*)\/\/.*$/gm, '$1$2');
  // trailing comma 제거 (마지막 항목 뒤의 쉼표)
  const withoutTrailingComma = withoutInlineComments.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingComma);
}

// JSONC 파싱 (주석 포함, 키-값과 주석 순서 유지)
function parseJsoncWithComments(content) {
  const result = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 한 줄 주석
    if (trimmed.startsWith('//')) {
      const comment = trimmed.slice(2).trim();
      if (comment) {
        result.push({ type: 'comment', value: comment });
      }
      continue;
    }

    // 키-값 쌍 찾기
    const match = trimmed.match(/^"([^"]+)"\s*:\s*"(.*)"/);
    if (match) {
      result.push({ type: 'entry', key: match[1], value: match[2].replace(/\\"/g, '"') });
    }
  }

  return result;
}

// 설정
const CONFIG = {
  masterDir: path.join(__dirname, '../master'),
  outputDir: path.join(__dirname, '../translations'),
  sourceLanguage: 'en', // xcstrings의 기본 언어
  platformNames: {
    ios: 'iOS',
    android: 'Android',
    react: 'React',
  },
};

// 마스터 파일 읽기
function readMasterFiles() {
  const languages = fs.readdirSync(CONFIG.masterDir).filter(f =>
    fs.statSync(path.join(CONFIG.masterDir, f)).isDirectory()
  );

  const data = {};
  const rawFiles = {}; // 주석 포함된 원본 구조

  for (const lang of languages) {
    const langDir = path.join(CONFIG.masterDir, lang);
    const files = fs.readdirSync(langDir).filter(f => f.endsWith('.jsonc'));

    for (const file of files) {
      const module = path.basename(file, '.jsonc');
      const fileContent = fs.readFileSync(path.join(langDir, file), 'utf8');
      const content = parseJsonc(fileContent);

      if (!data[module]) {
        data[module] = {};
      }
      data[module][lang] = content;

      // 주석 포함된 구조 저장
      if (!rawFiles[module]) {
        rawFiles[module] = {};
      }
      rawFiles[module][lang] = parseJsoncWithComments(fileContent);
    }
  }

  return { data, languages, rawFiles };
}

// iOS xcstrings 생성
function generateiOS(data, languages) {
  const iosDir = path.join(CONFIG.outputDir, 'ios');
  fs.mkdirSync(iosDir, { recursive: true });

  for (const [module, translations] of Object.entries(data)) {
    const keys = [...new Set(
      Object.values(translations).flatMap(t => Object.keys(t))
    )];

    const xcstrings = {
      sourceLanguage: CONFIG.sourceLanguage,
      strings: {},
      version: '1.0',
    };

    for (const key of keys) {
      xcstrings.strings[key] = {
        extractionState: 'manual',
        localizations: {},
      };

      for (const lang of languages) {
        if (translations[lang] && translations[lang][key]) {
          xcstrings.strings[key].localizations[lang] = {
            stringUnit: {
              state: 'translated',
              value: replacePlatform(translations[lang][key], 'ios'),
            },
          };
        }
      }
    }

    const fileName = toPascalCase(module) + '.xcstrings';
    const jsonStr = JSON.stringify(xcstrings, null, 2).replace(/": /g, '" : ');
    fs.writeFileSync(path.join(iosDir, fileName), jsonStr);
    console.log(`✓ iOS: ${fileName}`);
  }
}

// Android strings.xml 생성
function generateAndroid(data, languages, rawFiles) {
  for (const lang of languages) {
    const dirName = lang === CONFIG.sourceLanguage ? 'values' : `values-${lang}`;
    const androidDir = path.join(CONFIG.outputDir, 'android', dirName);
    fs.mkdirSync(androidDir, { recursive: true });

    for (const [module, translations] of Object.entries(data)) {
      if (!translations[lang]) continue;

      let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';

      // 주석 포함된 구조 사용
      const parsed = rawFiles[module]?.[lang] || [];

      for (const item of parsed) {
        if (item.type === 'comment') {
          xml += `\n    <!-- ${item.value} -->\n`;
        } else if (item.type === 'entry') {
          const escapedValue = escapeXml(replacePlatform(item.value, 'android'));
          xml += `    <string name="${item.key}">${escapedValue}</string>\n`;
        }
      }

      xml += '</resources>\n';

      const fileName = `strings_${module}.xml`;
      fs.writeFileSync(path.join(androidDir, fileName), xml);
      console.log(`✓ Android (${lang}): ${fileName}`);
    }
  }
}

// React JSON 생성
function generateReact(data, languages) {
  for (const lang of languages) {
    const reactDir = path.join(CONFIG.outputDir, 'react', lang);
    fs.mkdirSync(reactDir, { recursive: true });

    for (const [module, translations] of Object.entries(data)) {
      if (!translations[lang]) continue;

      const fileName = `${module}.json`;
      const replaced = {};
      for (const [k, v] of Object.entries(translations[lang])) {
        replaced[k] = replacePlatform(v, 'react');
      }
      fs.writeFileSync(
        path.join(reactDir, fileName),
        JSON.stringify(replaced, null, 2)
      );
      console.log(`✓ React (${lang}): ${fileName}`);
    }
  }
}

// 유틸리티 함수들
function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function replacePlatform(str, platform) {
  return str.replace(/\{\{platform\}\}/g, CONFIG.platformNames[platform]);
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, "\\'");
}

// 출력 폴더 초기화
function cleanOutputDir() {
  if (fs.existsSync(CONFIG.outputDir)) {
    fs.rmSync(CONFIG.outputDir, { recursive: true });
    console.log('🗑️  기존 translations 폴더 삭제\n');
  }
}

// 메인 실행
function main() {
  console.log('🌍 다국어 파일 생성 시작...\n');

  cleanOutputDir();

  const { data, languages, rawFiles } = readMasterFiles();

  console.log(`📁 모듈: ${Object.keys(data).join(', ')}`);
  console.log(`🗣️  언어: ${languages.join(', ')}\n`);

  generateiOS(data, languages);
  console.log('');
  generateAndroid(data, languages, rawFiles);
  console.log('');
  generateReact(data, languages);

  console.log('\n✅ 완료!');
}

main();

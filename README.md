# Multi-Language i18n Generator

iOS, Android, React 프로젝트를 위한 다국어 파일 생성기입니다.
하나의 마스터 JSONC 파일을 관리하면 각 플랫폼에 맞는 포맷으로 자동 변환됩니다.

## 구조

```
project/
├── master/                    # 원본 파일 (직접 수정)
│   ├── en/
│   │   ├── common.jsonc
│   │   ├── auth.jsonc
│   │   ├── error.jsonc
│   │   └── server_error.jsonc
│   └── ko/
│       ├── common.jsonc
│       ├── auth.jsonc
│       ├── error.jsonc
│       └── server_error.jsonc
│
├── translations/              # 생성된 파일 (자동 생성, git 제외)
│   ├── ios/                   # .xcstrings (PascalCase 파일명)
│   ├── android/               # strings.xml (주석 포함)
│   └── react/                 # .json
│
├── scripts/
│   └── generate-i18n.js
│
├── .gitignore
└── package.json
```

## 출력 포맷

| 플랫폼 | 포맷 | 예시 경로 |
|--------|------|-----------|
| iOS | `.xcstrings` | `translations/ios/Common.xcstrings` |
| Android | `strings.xml` | `translations/android/values/strings_common.xml` |
| React | `.json` | `translations/react/en/common.json` |

## 주요 기능

- **JSONC 지원**: 마스터 파일에서 `//` 주석과 trailing comma 사용 가능
- **주석 보존**: JSONC 주석이 Android XML에 `<!-- -->` 형태로 포함
- **플랫폼 변수**: `{{platform}}`을 사용하면 각 플랫폼명(iOS, Android, React)으로 자동 치환
- **iOS xcstrings**: `extractionState: "manual"` 설정으로 Xcode 경고 방지, Xcode 네이티브 포맷(`" : "`) 준수
- **iOS 파일명**: 모듈명을 PascalCase로 변환 (예: `server_error` → `ServerError.xcstrings`)
- **클린 빌드**: 실행 시 `translations/` 폴더를 삭제 후 새로 생성

## 사용법

### 다국어 파일 생성

```bash
npm run generate-i18n
```

### 마스터 파일 수정

`master/{언어}/{모듈}.jsonc` 형식으로 파일을 수정합니다.

```jsonc
// master/en/auth.jsonc
{
  // Login Page
  "login_title": "Log in to Your Account",
  "login_subtitle": "Please enter your email and password.",

  // Signup Page
  "signup_title": "Create Your Account",
}
```

### 플랫폼 변수 사용

`{{platform}}`을 사용하면 플랫폼별로 다른 값이 생성됩니다.

```jsonc
{
  "application_name": "Example {{platform}}",
}
```

생성 결과:
- iOS: `"Example iOS"`
- Android: `"Example Android"`
- React: `"Example React"`

### 새 모듈 추가

각 언어 폴더에 동일한 이름의 JSONC 파일을 생성합니다.

```
master/en/settings.jsonc
master/ko/settings.jsonc
```

스크립트 실행 시 자동으로 각 플랫폼 파일이 생성됩니다:
- `translations/ios/Settings.xcstrings`
- `translations/android/values/strings_settings.xml`
- `translations/android/values-ko/strings_settings.xml`
- `translations/react/en/settings.json`
- `translations/react/ko/settings.json`

### 새 언어 추가

`master/` 아래에 언어 코드 폴더를 생성하고 동일한 모듈 파일들을 추가합니다.

```
master/ja/common.jsonc
master/ja/auth.jsonc
master/ja/error.jsonc
master/ja/server_error.jsonc
```

## 설정

`scripts/generate-i18n.js`의 `CONFIG` 객체에서 설정을 변경할 수 있습니다.

```javascript
const CONFIG = {
  masterDir: path.join(__dirname, '../master'),
  outputDir: path.join(__dirname, '../translations'),
  sourceLanguage: 'en',
  platformNames: {
    ios: 'iOS',
    android: 'Android',
    react: 'React',
  },
};
```

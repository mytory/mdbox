---
name: mdbox-translation
description: mytory mdbox 다국어화 작업을 할 때 읽고 그대로 진행합니다.
---

두 계층으로 구성된 하이브리드 번역 시스템입니다.

### 1. 시스템 개요

| 계층 | 담당 | 파일 |
|---|---|---|
| **MytoryI18n** | HTML 정적 텍스트 (`data-mi18n-*` 속성) | `renderer/mytory-i18n/mytory-i18n.js` + `renderer/index.html` |
| **translations.js** | JS 동적 텍스트 (`t()` 함수) | `renderer/translations.js` + `renderer/app.js`의 `t()` |

두 계층의 언어 상태는 `applyLanguage()`에서 `MytoryI18n.setLanguage(lang)` 호출로 항상 동기화됩니다.

### 2. 지원 언어 (9개)

| 코드 | 언어 | 비고 |
|---|---|---|
| `en` | English | HTML 본문 기본값 (fallback 최종) |
| `ko` | 한국어 | `data-mi18n-ko` |
| `ja` | 日本語 | `data-mi18n-ja` |
| `zh-cn` | 简体中文 | 키에 하이픈 포함, `'zh-cn'` 따옴표 필요 |
| `es` | Español | |
| `pt` | Português | |
| `fr` | Français | |
| `id` | Bahasa Indonesia | |
| `hi` | हिन्दी | |

### 3. JS 동적 번역: `t()` 함수

`renderer/translations.js`에 모든 번역 데이터가 있습니다.

#### 기본 사용

```javascript
t('Conversion Complete')
```

`translations` 맵에서 `'Conversion Complete'` 키를 찾아 현재 언어로 반환합니다.

#### 하위 호환 (레거시)

```javascript
t('Conversion Complete', '인코딩 완료')
```

맵에 키가 있으면 맵 우선, 없으면 한국어/영어 fallback.

#### 템플릿 동적 문자열

런타임에 값이 결정되는 문자열은 `!`로 시작하는 템플릿 키를 사용합니다.
`templateTranslations`에 언어별 함수를 정의하고 호출 시 인자를 전달합니다.

```javascript
// translations.js에 정의:
const templateTranslations = {
    '!hardware_encoding': {
        en: (name) => \`Using hardware encoding: \${name}\`,
        ko: (name) => \`하드웨어 인코딩 사용 중: \${name}\`,
        ja: (name) => \`ハードウェアエンコードを使用中: \${name}\`,
        // ...
    },
};

// app.js에서 호출:
t('!hardware_encoding', encoders.h264)
```

### 4. HTML 정적 번역: `data-mi18n-*` 속성

HTML 본문은 **영어**를 기본값으로 합니다. 모든 언어의 번역은 `data-mi18n-{locale}` 속성에 넣습니다.

```html
<span class="label"
      data-mi18n-ko="배속 변환기"
      data-mi18n-ja="速度変換"
      data-mi18n-zh-cn="倍速转换">Speed Changer</span>
```

#### 속성 번역

```html
<img data-mi18n-ko-attr-src="ko.png" data-mi18n-ko-attr-alt="한국어" src="en.png" alt="English">
```

#### `data-mi18n-block` (언어별 블록)

HTML 구조 자체가 언어마다 달라야 할 때 사용합니다. 해당 언어일 때만 요소가 노출됩니다.

```html
<span class="help-tip__bubble">
    <span data-mi18n-block="ko">한국어 도움말...</span>
    <span data-mi18n-block="en">English help...</span>
    <span data-mi18n-block="ja">日本語のヘルプ...</span>
</span>
```

`data-mi18n-block`에 여러 언어를 쉼표로 지정할 수 있습니다: `data-mi18n-block="en,ja"`

### 5. 언어 감지 및 저장

1. `localStorage.getItem('mytory-video-lang')` 확인
2. 없으면 `navigator.language` 감지 → 지원 언어 목록과 매칭
3. 매칭되는 언어가 없으면 `'en'`
4. 언어 선택기(`#langSelect`)에서 변경 시 `localStorage`에 저장

### 6. 새 언어 추가 절차

1. `renderer/translations.js`의 `LANG_ORDER` 배열에 언어 코드 추가
2. 모든 `translations` 키에 새 언어 항목 추가 (없으면 영어 fallback)
3. 각 `templateTranslations` 키에 언어별 함수 추가
4. `renderer/index.html`의 `#langSelect`에 `<option>` 추가
5. `renderer/app.js`의 `initApp()` 함수 내 `supportedLangs` 배열에 추가
6. HTML에 필요한 `data-mi18n-{locale}` 속성 추가
7. `data-mi18n-block` 블록이 있으면 새 언어 블록 추가
8. `README.{locale}.md` 파일 생성
9. `README.md`와 `README.ko.md`의 언어 링크 목록 업데이트

### 7. 번역 조회 우선순위 (fallback)

```
1. translations[key].{locale}  (예: zh-cn)
2. translations[key].{base}    (예: zh)
3. translations[key].en        (영어)
4. t(en, ko) 레거시 인자       (한국어 > 영어)
5. HTML 본문 텍스트            (영어)
```

### 8. 참고 문서

- `renderer/mytory-i18n/readme.md` — MytoryI18n 라이브러리 상세 문서
- `renderer/translations.js` — 전체 번역 맵
- `renderer/app.js`의 `t()` 함수 — 번역 조회 로직

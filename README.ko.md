# Mytory MDBox

**파일을 드롭하면 Markdown이 나옵니다. 묻지도, 따지지도 않습니다.**

Mytory MDBox는 파일을 드롭하면 즉시 Markdown으로 변환해 주는 크로스플랫폼 데스크톱 앱입니다.

## 특징

- **드롭앤던이** — 파일을 앱에 드롭하거나 클릭해서 선택하면 바로 변환. 묻지도, 따지지도 않습니다.
- **다중 파일 / 폴더** — 여러 파일이나 폴더째 드롭하면 재귀적으로 모두 변환.
- **다양한 포맷 지원** — Microsoft Markitdown 엔진 탑재. DOCX, PPTX, XLSX, PDF, HTML, CSV, JSON, XML, EPUB, IPYNB, TXT, ZIP, 이미지 등.
- **출력 모드 선택** — Sidecar (원본 옆 .md 생성) / 클립보드 복사 / 사용자 지정 폴더.
- **LLM 연동 (선택)** — OpenAI 호환 API 또는 Ollama 로컬 LLM을 연결하면 이미지 캡셔닝 지원.
- **오프라인 기본** — 별도 설정 없이 완전한 오프라인 동작.
- **크로스플랫폼** — macOS, Windows, Linux 모두 지원.

## 다운로드

[GitHub Releases](https://github.com/mytory/mdbox/releases)에서 최신 버전을 다운로드하세요.

| 플랫폼 | 파일 | 비고 |
|---|---|---|
| macOS (Apple Silicon) | `.dmg` (arm64) | |
| macOS (Intel) | `.dmg` (x64) | |
| Windows | `Setup.exe` | |
| Linux | `.AppImage` | |

### ⚠️ 보안 경고 (필독)

본 프로그램은 개인 개발자가 배포하는 오픈소스 소프트웨어로, 유료 개발자 인증서 서명이 되어 있지 않습니다. 실행 시 발생하는 보안 경고는 프로그램의 결함이 아니니 아래 방법으로 실행해 주세요.

**Windows:** 빨간색 경고창에서 **[추가 정보]** 클릭 → **[실행]** 버튼 클릭
**macOS:** 앱을 더블클릭 → 보안 경고 발생 시 **시스템 설정 → 개인정보 보호 및 보안 → 보안** 섹션 하단의 **[그래도 열기]** 버튼 클릭 → 확인 대화상자에서 확인

## 웹사이트

소개 페이지: [mytory.github.io/mdbox](https://mdbox.mytory.net/)

| 언어 | 링크 |
|---|---|
| English | [index.html](https://mdbox.mytory.net/) |
| 한국어 | [ko/index.html](https://mdbox.mytory.net/ko/) |

## 개발

```bash
# 클론
git clone https://github.com/mytory/mdbox.git
cd mdbox

# 의존성 설치 (Electron + PyInstaller 바이너리 자동 빌드)
npm install
npm run build:python   # Python 변환 엔진 빌드

# 실행
npm start

# 테스트
npm run test:python

# 배포 빌드
npm run dist
```

## 기술 스택

| 구성 | 기술 |
|---|---|
| 데스크톱 프레임워크 | [Electron](https://www.electronjs.org/) |
| 변환 엔진 | [Microsoft Markitdown](https://github.com/microsoft/markitdown) |
| Python 번들링 | [PyInstaller](https://pyinstaller.org/) |
| 패키징 | [electron-builder](https://www.electron.build/) |

## 라이선스

GPL-3.0-only

# ADR 0001: PyInstaller로 markitdown을 임베드한다

**상태:** 채택

**날짜:** 2026-07-07

## 맥락

Mytory MDBox는 Microsoft의 `markitdown` 라이브러리를 이용해 파일을 Markdown으로 변환해야 한다. `markitdown`은 Python 패키지다.

일렉트론 앱에 통합하는 방법으로 네 가지를 검토했다:

| 방법 | 설명 |
|---|---|
| **시스템 Python** | 사용자가 Python을 설치하고 `pip install markitdown`을 실행. 일렉트론이 Python 스크립트를 spawn. |
| **CLI 서브프로세스** | `markitdown`이 제공하는 CLI를 바로 호출. 위와 같지만 스크립트 레이어가 하나 줄어듦. |
| **PyInstaller 번들** | `markitdown` + 진입점 스크립트를 PyInstaller로 묶어 단일 바이너리로 만듦. |
| **Node.js 포팅** | markitdown의 JS 포트를 찾거나 직접 만듦. |

## 결정

**PyInstaller**로 `markitdown`과 얇은 래퍼 스크립트를 플랫폼별 단일 바이너리로 번들링한다. 이 바이너리를 일렉트론 앱의 `asar.unpacked` 디렉터리에 포함시키고 서브프로세스로 실행한다.

## 근거

1. **사용자에게 추가 런타임이 필요 없다.** Python, pip, 시스템 패키지가 전혀 필요 없다. 앱 하나로 모든 것이 해결된다 — 진정한 "드롭앤던이".

2. **검증된 패턴이다.** 참고 프로젝트(mytory-video-tools)에서 이미 ffmpeg/ffprobe를 플랫폼별 바이너리로 번들링해서 spawn하는 방식을 쓰고 있다. 동일한 아키텍처, 동일한 빌드 도구.

3. **용량이 부담되지 않는다.** markitdown의 pure Python 의존성들(python-docx, python-pptx, openpyxl, pypdf, html2text 등)을 PyInstaller로 묶으면 약 30~60MB. ffmpeg-static(약 40MB)과 비슷한 수준.

4. **IPC가 단순하다.** 변환은 순수 함수다: 파일 입력 → Markdown 출력. 래퍼가 stdin으로 JSON 요청을 받고, markitdown을 호출하고, stdout으로 JSON을 반환한다. 스트리밍이나 복잡한 진행률 파싱이 필요 없다.

5. **기본은 오프라인, LLM은 선택.** 번들된 바이너리는 완전히 오프라인으로 동작한다. LLM 기반 기능(이미지 캡셔닝)은 사용자가 설정에서 자격 증명을 입력해야만 활성화된다.

## 결과

### 긍정적

- Python 코드는 `python/`, JS/HTML은 `renderer/`로 관심사가 명확히 분리된다.
- 래퍼 스크립트를 일렉트론과 독립적으로 테스트할 수 있다.
- 향후 .hwp 같은 추가 컨버터를 별도의 Python 바이너리로 쉽게 추가할 수 있다.

### 부정적

- 빌드 파이프라인이 두 단계로 나뉜다: PyInstaller → electron-builder. CI/CD에서 두 단계를 모두 처리해야 한다.
- 바이너리가 플랫폼별로 다르다. darwin-x64, darwin-arm64, linux-x64, win32-x64 각각을 빌드해서 배포해야 한다.
- Python 바이너리 내부에서 실패한 경우 디버깅이 일반 Python 스크립트보다 어렵다.

## 검토한 대안

### 시스템 Python / CLI 서브프로세스

"드롭앤던이" 원칙을 위반하므로 기각. 사용자에게 Python 설치를 요구하는 것은 가치보다 마찰이 앞선다.

### Node.js 포팅

markitdown의 16만 개가 넘는 스타와 Microsoft의 관리 감독은 상당한 정확성과 포맷 커버리지 투자를 의미한다. JS로 다시 구현하면 뒤쳐지고 버그가 발생할 가능성이 높으므로 기각.

## 참고

- PyInstaller 바이너리는 CI에서 플랫폼별로 빌드하고 빌드 아티팩트로 저장한 뒤, `electron-builder`의 `extraResources` 또는 `asarUnpack`에서 참조한다.
- 래퍼 스크립트(`python/converter.py`)는 다음을 처리해야 한다: 파일 경로 입력, markitdown 변환, 기본 오류 보고, 선택적 LLM 클라이언트 주입.

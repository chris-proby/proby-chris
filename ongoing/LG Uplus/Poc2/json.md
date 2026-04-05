# LG U+ 가이드라인 2차 · `survey_draft` JSON 양식

Proby용 인터뷰 가이드(`survey_draft`) 구조입니다. **전체 문항·분기가 들어 있는 원본**은 같은 폴더의 `가이드라인_2차-survey-draft.json`이며, `build_lg_guideline_2nd_survey_draft.py`로 엑셀 `가이드라인 2차.xlsx`에서 생성합니다.

## 루트

- 최상위 키는 **`survey_draft` 하나**입니다. (`chapters`를 루트에 두지 않습니다.)
- 챕터 배열 키는 **`interview_chapters`** 입니다.

## `survey_draft` 주요 필드

| 필드 | 설명 |
|------|------|
| `title`, `description` | 조사 제목·설명 |
| `welcome_title`, `welcome_message` | 환영 문구 |
| `goal`, `target_audience` | 조사 목적·모집 조건 |
| `quota` | 목표 인원(숫자) |
| `user_groups` | 사용자 그룹 (보통 `[]`) |
| `user_inputs` | 사전 입력 필드 (이름 등) |
| `screener_questions` | 스크리너 (보통 `[]`) |
| `interview_opening` | 인터뷰 오프닝 멘트 |
| `interview_chapters` | 챕터 → 토픽 → 질문 |

## 질문(`questions[]`) 객체

| 필드 | 설명 |
|------|------|
| `id` | UUID |
| `readable_id` | 예: `question_1_1_1` |
| `content` | 참가자에게 읽는 질문 본문 |
| `question_type` | 예: `open_text` |
| `options` | 선택지 없으면 `null` |
| `rating_min`, `rating_max` | 평점 범위 없으면 `null` |
| `probing_guide` | 엑셀 문항 태그, 예: `[Q1]` |
| `probing_plan` | 아래 참고 |
| `response_type` | 예: `episode` |
| `duration_sec` | 권장 답변 시간(초) |
| `media` | 보통 `[]` |

가이드라인 빌드 산출물에는 **`display_condition`**, **`is_probe`** 같은 필드를 넣지 않습니다. 세그먼트·스크리닝은 `probing_plan.branches[].note` 등으로 반영합니다.

## `probing_plan`

| 필드 | 설명 |
|------|------|
| `root_note` | 모더 공통 지시 — 현재 `"동일하거나 유사한 취지의 질문은 반복하지 않는다"` 한 줄만 |
| `root_checklist` | 추가 질문/프로빙 — `{ "id", "text", "position" }` 배열 |
| `branches` | 예상 참가자 발화 분기 — 문항당 최소 10개 권장 |

### `branches[]` 항목

| 필드 | 설명 |
|------|------|
| `id` | UUID |
| `if` | 참가자가 말할 법한 구체적 한두 문장 |
| `note` | 모더 전용(선행 `[세그먼트]` 등). 참가자에게 읽지 않음 |
| `position` | 순서 (0부터) |
| `checklist` | 팔로업 `{ "id", "text", "position" }` (보통 `text` 하나) |
| `branches` | 중첩 (보통 `[]`) |

선행 `[…]` 세그먼트만 있는 가이드는 `content`에는 짧은 전환 문장만 두고, 실제 질문은 모든 분기의 `checklist[0].text`에 통일합니다. (`.cursor/rules/guideline-shortcut.mdc` 1-보조 규칙과 동일)

---

## 예시 (구조 확인용 — Q1 한 문항)

```json
{
  "survey_draft": {
    "title": "LG U+ · 가이드라인 2차 (가입 초기 경험)",
    "description": "LG U+ Poc2 · 엑셀 `가이드라인 2차.xlsx`의 `가이드라인_수정` 시트(항목·번호·인터뷰 가이드·비고) 기반. 생성: build_lg_guideline_2nd_survey_draft.py · 질문별 예상 답변 분기·팔로업: build_follow_up_branches()",
    "welcome_title": "안녕하세요 인터뷰에 참여해 주셔서 감사합니다",
    "welcome_message": "오늘 인터뷰는 통신 가입 이후 경험과 인식에 대해 이야기 나눕니다.",
    "goal": "가입 초기 고객 NPS 향상을 위한 가입 초기 고객 경험 분석",
    "target_audience": "연령대: 20대~50대\n통신사: LGU+(2), SKT(2), KT(2)\n가입 채널: 소매점(직영/대리점) (2), 도매/판매점(2), 온라인몰(닷컴)(2)\n가입 유형: 번호 이동 고객\nFrom SKT To KT(1) /LGU+(1)\nFrom LGU+ To SKT(1) /KT(1)\nFrom KT To SKT(1) /LGU+(1)\n가입 기간: 2026년 1월 이후 가입자 (최근 2개월내 가입) - 한번 이상의 청구 경험이 있는자\n가입 요금제: OTT 서비스 제공하는 7만원대 이상 요금제 가입자\n결합 여부: 최근 가입시 결합도 같이 (시도)한 고객 - 유+무선, 무+무선\n- tv 또는 인터넷 무방\n부가서비스 사용 여부: 유료/무료 부가서비스 설정/가입 및 확인하는 자\n- 듀얼넘버, V컬러링, 스팸차단, 통화중 대기, 착신전환 등\n- 내가 동의하지 않는 유료 부가서비스가 가입되어 있다거나, 의무적으로 3~6개월간 부가서비스 사용을 해야 한다고 안내를 받았는지 등 행태 및 인식 파악 목적\n멤버십: 이전/현 통신사에서 멤버십 사용에 관심 및 사용에 적극적인자 \n- 월 2회 이상\nNPS: 7점이하 (0~6점 우선리크루팅)\n통화/데이터 품질: 통신사 변경 후 통화/데이터 품질 불만 경험자 (자사는 필수)",
    "quota": 10,
    "user_groups": [],
    "user_inputs": [
      {
        "id": "4ae5e433-d811-404a-bad1-0ca95f6a6506",
        "readable_id": "user_input_1",
        "label": "이름을 적어 주세요 (또는 닉네임)"
      }
    ],
    "screener_questions": [],
    "interview_opening": "안녕하세요. 저는 오늘 인터뷰를 진행하는 AI 인터뷰어입니다.\n정답은 없으며, 경험하신 대로 편하게 말씀해 주시면 됩니다.\n조건에 해당하지 않는 질문은 건너뛰어도 됩니다.\n준비되셨으면 '준비되었어요'라고 말씀해 주세요.",
    "interview_chapters": [
      {
        "id": "e5ac7812-d897-4919-a4e2-5d02539e9461",
        "readable_id": "chapter_1",
        "title": "배경/상황 파악",
        "topics": [
          {
            "id": "66c2b9f6-0653-4b1c-8fd2-c6c968657e61",
            "readable_id": "topic_1_1",
            "title": "배경/상황 파악",
            "questions": [
              {
                "id": "80de8d53-7b25-4d1c-8b9d-e4a3433a3ebc",
                "readable_id": "question_1_1_1",
                "content": "가입은 어디서 했나요?",
                "question_type": "open_text",
                "options": null,
                "rating_min": null,
                "rating_max": null,
                "probing_guide": "[Q1]",
                "probing_plan": {
                  "root_note": "동일하거나 유사한 취지의 질문은 반복하지 않는다",
                  "root_checklist": [],
                  "branches": [
                    {
                      "id": "7d4b2221-2f92-449c-9bca-dabd7771bc7b",
                      "if": "가입은 빨리 끝났는데 개통 문자만 와서 자세히는 잘 몰라요.",
                      "note": "",
                      "position": 0,
                      "checklist": [
                        {
                          "id": "44d0c735-14a1-4c90-b038-1791a5a7255c",
                          "text": "개통 문자 받으신 뒤에 앱 깔거나 설정하시면서 헷갈리신 적은 없었나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "a021a724-1f29-4bce-a18a-0d335e64b1b0",
                      "if": "T월드 매장에서 SKT로 했어요.",
                      "note": "",
                      "position": 1,
                      "checklist": [
                        {
                          "id": "2db7c7fe-0ff8-4018-bd91-2214e36a8f10",
                          "text": "SKT 매장이라고 하셨는데, 번호이동 할인이나 기기 할부 조건은 어떻게 안내받으셨나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "a8bbe0f1-9aea-4ad6-be19-133944e81018",
                      "if": "KT 공식 홈페이지에서 신청했습니다.",
                      "note": "",
                      "position": 2,
                      "checklist": [
                        {
                          "id": "73e6ad13-354b-4149-b2fa-baf713fdb923",
                          "text": "신청 과정에서 자동으로 체크된 항목이나, 나중에 보니 의외였던 항목이 있었나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "21f8527b-cf7f-4a79-b947-0a8862b74a27",
                      "if": "네, 그랬어요.",
                      "note": "",
                      "position": 3,
                      "checklist": [
                        {
                          "id": "1bc98d09-7a68-4e54-b36b-a993e31a39e6",
                          "text": "방금 '그랬다'고 하신 부분을 시간 순서로 조금만 더 풀어서 말씀해 주실 수 있을까요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "986ba45a-ad67-499f-8670-3075c632d51f",
                      "if": "아니요, 없었어요.",
                      "note": "",
                      "position": 4,
                      "checklist": [
                        {
                          "id": "4c6b32e1-1b09-457d-b932-47d96a5a5872",
                          "text": "없었다고 하셨는데 혹시 잠깐이라도 불편했던 순간은 없었는지 떠올려보시겠어요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "a37c9afe-fc27-400d-96be-b6cea086f59d",
                      "if": "잘 기억은 안 나요.",
                      "note": "",
                      "position": 5,
                      "checklist": [
                        {
                          "id": "3940dde0-4b74-42b7-97b6-2a3d8cdb5fbe",
                          "text": "괜찮습니다. 「가입은 어디서 했나요?」와 관련해 가장 최근에 떠오르는 장면 하나만 짧게 말씀해 주실 수 있을까요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "8282f419-53b3-4f9b-b230-56b0ebdd6cd8",
                      "if": "유플러스 직영 매장에서 가입했어요.",
                      "note": "",
                      "position": 6,
                      "checklist": [
                        {
                          "id": "f7053e21-a578-4d2c-8b79-7e6abfe07197",
                          "text": "그날 상담은 대략 몇 분 정도 걸렸고, 직원분이 특히 강조해서 설명해 주신 부분이 있었나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "fa364f22-55dc-41e0-8bec-05f5c57c55e1",
                      "if": "대리점에서 했습니다. 한 통신사만 파는 곳이었어요.",
                      "note": "",
                      "position": 7,
                      "checklist": [
                        {
                          "id": "6702a057-6c17-4be2-9502-169fcca066a8",
                          "text": "대리점이라고 하셨는데, 다른 통신사 상품이랑 비교 견적도 같이 받아보셨나요, 아니면 한 곳만 보셨나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "80114df6-522d-452d-898c-f8fc8978c7f2",
                      "if": "LG 유플러스 닷컴에서 혼자 온라인으로 가입했어요.",
                      "note": "",
                      "position": 8,
                      "checklist": [
                        {
                          "id": "4b6508bb-bfa8-455b-94b0-fc9a35ed0978",
                          "text": "온라인으로 진행하실 때 본인인증이나 서류 제출 중에 막히거나 헷갈린 단계가 있었나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    },
                    {
                      "id": "ba8a4c70-e4a4-4193-bb85-c241c2e1efdd",
                      "if": "114에 전화해서 상담 받고 가입 연결됐어요.",
                      "note": "",
                      "position": 9,
                      "checklist": [
                        {
                          "id": "770090bc-0813-4771-a383-765afdb3ff3b",
                          "text": "전화 상담에서 들었던 월 요금이나 혜택 설명이, 개통 뒤 앱이나 문자로 본 내용이랑 다른 느낌은 없었나요?",
                          "position": 0
                        }
                      ],
                      "branches": []
                    }
                  ]
                },
                "response_type": "episode",
                "duration_sec": 45,
                "media": []
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 전체 데이터

- 파일: **`가이드라인_2차-survey-draft.json`**
- 사본: `가이드라인_2차-survey-draft-new.json` (동일 스키마일 수 있음)

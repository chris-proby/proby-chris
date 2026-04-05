#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Downloads `가이드라인 - Sheet1.csv` 내용을 반영한 survey_draft.json 생성."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parent / "가이드라인_Sheet1-survey-draft.json"


def nid() -> str:
    return str(uuid.uuid4())


def ck(text: str, pos: int) -> dict:
    return {"id": nid(), "text": text, "position": pos}


def branch(if_text: str, items: list[tuple[str, int]], pos: int, note: str = "") -> dict:
    return {
        "id": nid(),
        "if": if_text,
        "note": note,
        "position": pos,
        "checklist": [ck(t, p) for t, p in items],
        "branches": [],
    }


def q(
    readable_id: str,
    content: str,
    root_checklist: list[str],
    branches: list[dict] | None = None,
    duration_sec: int = 45,
    probing_null: bool = False,
) -> dict:
    if probing_null:
        return {
            "id": nid(),
            "readable_id": readable_id,
            "content": content,
            "question_type": "open_text",
            "options": None,
            "rating_min": None,
            "rating_max": None,
            "probing_guide": None,
            "probing_plan": None,
            "response_type": "episode",
            "duration_sec": duration_sec,
            "media": [],
        }
    return {
        "id": nid(),
        "readable_id": readable_id,
        "content": content,
        "question_type": "open_text",
        "options": None,
        "rating_min": None,
        "rating_max": None,
        "probing_guide": None,
        "probing_plan": {
            "root_note": "",
            "root_checklist": [ck(t, i) for i, t in enumerate(root_checklist)],
            "branches": branches or [],
        },
        "response_type": "episode",
        "duration_sec": duration_sec,
        "media": [],
    }


def main() -> None:
    survey = {
        "survey_draft": {
            "title": "통신사 이동 고객 온보딩·이용 경험 인터뷰",
            "description": "`가이드라인 - Sheet1.csv` 기반. 통신사 변경 직후 가입·온보딩 여정, NPS, 요금·부가·결합·멤버십·네트워크·첫 청구까지 심층 탐색.",
            "welcome_title": "안녕하세요, 인터뷰에 참여해 주셔서 감사합니다",
            "welcome_message": "오늘은 통신사를 옮기신 이후 가입 과정과 이용 경험에 대해 편하게 이야기 나눕니다.",
            "goal": "이동 고객 온보딩·초기 이용 경험 파악 및 개선 우선순위 도출",
            "target_audience": "최근 통신사를 변경한 이동 고객(가입 직후~초기 이용 단계)",
            "quota": 10,
            "user_groups": [],
            "user_inputs": [
                {
                    "id": nid(),
                    "readable_id": "user_input_1",
                    "label": "이름 또는 닉네임을 적어 주세요",
                }
            ],
            "screener_questions": [],
            "interview_opening": "안녕하세요, 반갑습니다. 오늘은 정해진 답이 아니라 본인 경험과 느낌을 편하게 말씀해 주시면 됩니다. 짧은 답만 이어지면 가볍게 한두 번만 더 여쭤볼 수 있어요. 준비되시면 시작할게요.",
            "interview_chapters": [
                {
                    "id": nid(),
                    "readable_id": "chapter_1",
                    "title": "가입 배경 & 추천 의향",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "가입 경로·상품 구성",
                            "questions": [
                                q(
                                    "question_1",
                                    "통신사 가입은 어디서 하셨나요? 직영몰, 도매, 소매점 등 채널을 말씀해 주시고, 이번에 옮기면서 선택하신 요금제와 결합(인터넷·TV·다른 단말·가족·지인 등) 여부, 그리고 가입하신 유료 부가서비스가 있다면 간단히 짚어 주세요.",
                                    [
                                        "가입 채널을 선택한 이유나 비교한 경험이 있었다면 확인",
                                        "결합·부가를 넣거나 빼면서 고민했던 점이 있었는지 확인",
                                    ],
                                    duration_sec=50,
                                )
                            ],
                        }
                    ],
                },
                {
                    "id": nid(),
                    "readable_id": "chapter_2",
                    "title": "추천 의향(NPS) & 비교",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "현재·이전 통신사",
                            "questions": [
                                q(
                                    "question_2",
                                    "지금 이용 중인 통신사를 다른 사람에게 추천할 의향이 어느 정도이신가요? 0점은 전혀 추천하지 않음, 10점은 적극 추천입니다. 점수를 말씀해 주신 뒤, 그렇게 평가하신 이유를 구체적인 경험과 함께 말씀해 주세요.",
                                    [
                                        "점수와 이유가 맞도록 한두 가지 사례를 더 붙여 달라고 요청",
                                        "추천을 망설이게 한 요소가 있다면 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "9~10점이라고 하신 경우,",
                                            [
                                                ("그렇게 높게 보게 된 결정적 순간이나 서비스가 있었는지 확인", 0),
                                                ("앞으로도 유지되려면 통신사가 해 주었으면 하는 점 확인", 1),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "7~8점이라고 하신 경우,",
                                            [
                                                ("10점이 아닌 이유, 아쉬웠던 한두 가지 확인", 0),
                                                ("바뀌면 점수가 오를 만한 부분 확인", 1),
                                            ],
                                            1,
                                        ),
                                        branch(
                                            "0~6점이라고 하신 경우,",
                                            [
                                                ("점수를 깎은 결정적 경험이나 사건이 있었는지 확인", 0),
                                                ("어떤 변화가 있으면 추천 의향이 달라질지 확인", 1),
                                            ],
                                            2,
                                        ),
                                    ],
                                    duration_sec=55,
                                ),
                                q(
                                    "question_3",
                                    "이전에 이용하시던 통신사에 대해서도, 같은 기준으로 0~10점 중 몇 점 정도를 주실 것 같으신가요? 점수와 함께 그렇게 평가한 이유도 말씀해 주세요.",
                                    [
                                        "현재 통신사와 비교해 달라진 점·비슷하다고 느낀 점 확인",
                                        "이전 통신사를 떠나게 된 결정적 이유가 있다면 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "이전과 현재가 비슷하거나 차이를 잘 모르겠다고 하신 경우,",
                                            [
                                                ("왜 차이를 못 느끼거나 비슷하다고 생각하셨는지 확인", 0),
                                                ("현 통신사 혜택·서비스를 더 잘 체감하려면 어떤 안내가 도움이 될지 확인", 1),
                                            ],
                                            0,
                                            note="가이드: 이전 통신사 대비 차이 체감이 약한 응답자",
                                        ),
                                        branch(
                                            "앞서 불편하다고 하신 경험이 있었다면,",
                                            [
                                                ("어떤 과정에서 어떤 일이 있었는지 순서대로 확인", 0),
                                                ("통신사 측 대응이 있었다면 어떻게 처리되었는지 확인", 1),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=55,
                                ),
                            ],
                        }
                    ],
                },
                {
                    "id": nid(),
                    "readable_id": "chapter_3",
                    "title": "가입 직후 여정",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "타임라인·알림",
                            "questions": [
                                q(
                                    "question_4",
                                    "가입 당일부터 약 2주까지를 하루 단위로 떠올려 보시겠어요? 기억나는 주요 일(개통·배송·설정·상담 등)을 순서대로 말씀해 주세요.",
                                    [
                                        "그중 가장 헷갈리거나 불안하거나 짜증 났던 순간이 언제였는지, 이유 확인",
                                        "그 순간 본인이 취한 행동(연락·검색·대기 등) 확인",
                                    ],
                                    duration_sec=60,
                                ),
                                q(
                                    "question_5",
                                    "가입 후 문자(MMS·RCS)나 카카오톡 알림이 어느 정도 왔다고 느끼셨나요? 많다·적다보다는 어떤 점이 부담이었는지, 반대로 도움이 되거나 안심이 됐던 점이 있었는지 말씀해 주세요. 가입 초기에 꼭 받아야 한다고 생각하는 알림, 발송 빈도·순서에 대한 생각, 문자 대신 앱·푸시·체크리스트로 안내하는 것에 대한 의견도 편하게 이어서 말씀해 주세요.",
                                    [
                                        "문의가 필요했던 순간이 있었다면 어디로·어떻게 연락했는지, 번호·채널이 여러 개여서 불편했는지 확인",
                                        "이상적인 고객 지원(한곳 통합·상황별 연결·챗 우선 등)에 대한 기대 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "알림이 과하다고 느끼신 경우,",
                                            [
                                                ("줄였으면 하는 종류나 시점이 있는지 확인", 0),
                                                ("남기고 싶은 알림은 무엇인지 확인", 1),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "알림이 부족하거나 놓친 것 같다고 느끼신 경우,",
                                            [
                                                ("어떤 정보를 더 일찍 받았으면 했는지 확인", 0),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=70,
                                ),
                            ],
                        }
                    ],
                },
                {
                    "id": nid(),
                    "readable_id": "chapter_4",
                    "title": "요금·부가·결합",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "요금제",
                            "questions": [
                                q(
                                    "question_6",
                                    "앞서 말씀해 주신 요금제를 이번에 선택하신 이유는 무엇인가요? 본인 사용 패턴에 맞춰 직접 고르신 건지, 가입처에서 제안을 받아 선택하신 건지도 알려 주세요. 일정 기간(예: 3~6개월) 의무로 쓰는 조건이 있는 요금제인지, 있다면 그때 선택하신 이유와 걱정되는 점이 있는지도 말씀해 주세요.",
                                    [
                                        "의무 사용 기간 안내가 명확했는지, 변경 가능 시점을 알려주는 서비스에 관심이 있는지 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "의무 사용 기간이 있는 요금제라고 하신 경우,",
                                            [
                                                ("그 조건을 수용한 이유와 불안 요소가 있는지 확인", 0),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "가입처 제안 위주로 선택하셨다고 한 경우,",
                                            [
                                                ("본인이 비교·검토한 범위가 어느 정도였는지 확인", 0),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=55,
                                ),
                            ],
                        },
                        {
                            "id": nid(),
                            "readable_id": "topic_2",
                            "title": "부가서비스",
                            "questions": [
                                q(
                                    "question_7",
                                    "요금제에 OTT·미디어 등이 포함된 경우, 계정 연동이나 설정해야 할 일이 명확했는지, 그 과정에서 불편했던 점과 해결 방법을 말씀해 주세요. 통신 관련 유·무료 부가서비스는 가입하지 않으셨다면 이유(필요 없음·몰라서 등), 유료 부가를 쓰고 계시다면 본인이 직접 가입했는지·안내·해지 방법 인지 여부·미사용 시 독려나 해지 안내에 대한 느낌, 필요한 무료 부가를 안내받지 못해 불편했던 경험이 있는지도 함께 짚어 주세요.",
                                    [
                                        "OTT·미디어 해당 여부에 따라 연동 이슈를 한 번 더 구체화",
                                        "유료 부가 가입이 본인 의도와 달랐는지 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "OTT·미디어 부가를 쓰는 요금제라고 하신 경우,",
                                            [
                                                ("연동·로그인 과정에서 막힌 지점이 있었는지 확인", 0),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "통신 부가를 일부러 넣지 않았다고 하신 경우,",
                                            [
                                                ("정보 부족 때문인지, 필요 없어서인지 구분해 확인", 0),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=65,
                                ),
                            ],
                        },
                        {
                            "id": nid(),
                            "readable_id": "topic_3",
                            "title": "결합",
                            "questions": [
                                q(
                                    "question_8",
                                    "결합(인터넷·TV·가족·지인 등)을 이번에 신청하셨거나, 당장은 아니지만 할 계획이 있으신가요? 결합을 하셨다면 어떤 상품과 누구와 묶이는지, 왜 결합을 선택하셨는지·기대했던 점은 무엇이었는지 말씀해 주세요. 진행 과정에서 어려움이 있었다면 무엇이었고 어떻게 해결하셨는지, 무선 결합 시 WAP 인증 동의가 잘 되었는지, 유선 개통·기사 방문 일정이 얽혀 불편했는지, 지금 결합 상태를 확인하는 방법이 쉬운지도 이야기해 주세요.",
                                    [
                                        "결합을 하지 않은 이유나 시기를 미루는 이유가 있다면 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "결합을 신청·진행 중이라고 하신 경우,",
                                            [
                                                ("과정 중 가장 헷갈렸던 단계 확인", 0),
                                                ("WAP·유선 일정 등 기술·일정 이슈가 있었는지 확인", 1),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "결합 예정이 없거나 보류 중이라고 하신 경우,",
                                            [
                                                ("향후 결합을 염두에 두고 있는지, 조건이 무엇인지 확인", 0),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=65,
                                ),
                            ],
                        },
                    ],
                },
                {
                    "id": nid(),
                    "readable_id": "chapter_5",
                    "title": "멤버십·네트워크·청구",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "멤버십",
                            "questions": [
                                q(
                                    "question_9",
                                    "현재 통신사 멤버십 혜택에 관심이 어느 정도이신가요? 본인 등급과 그 기준에 대해 어떻게 생각하시는지, 승급일을 미리 알려주는 것·장기 고객 기준에 대한 생각도 말씀해 주세요. 가입 후 한 달 안에 실제로 써 보신 적이 있다면 마음에 들었던 점, 안 쓰셨다면 이유, 선착순 혜택에 대한 감정, 가입 초기 고객만을 위한 혜택이 있다면 어떻게 느끼실지도 짚어 주세요.",
                                    [
                                        "멤버십을 가입 초기에 쓰게 하려면 어떤 안내·혜택이 필요할지 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "멤버십을 거의 쓰지 않는다고 하신 경우,",
                                            [
                                                ("안 쓰는 이유가 인지·절차·매력 부족 중 어디에 가까운지 확인", 0),
                                            ],
                                            0,
                                        ),
                                    ],
                                    duration_sec=60,
                                ),
                            ],
                        },
                        {
                            "id": nid(),
                            "readable_id": "topic_2",
                            "title": "네트워크·청구",
                            "questions": [
                                q(
                                    "question_10",
                                    "데이터 통화 품질(속도·끊김) 이슈를 겪으신 적이 있나요? 있다면 언제·어디서·얼마나 자주였는지, 변경 후 며칠 만에 처음 느끼셨는지 말씀해 주세요. 통신사가 해결해 줄 거라 기대하셨는지, 해결 경로가 명확했는지, 스스로 점검·해결 가이드를 앱 등으로 받는 것에 대한 생각도 이야기해 주세요.",
                                    [
                                        "문제를 접수하거나 해결해 본 경로가 있다면 확인",
                                    ],
                                    branches=[
                                        branch(
                                            "품질 이슈를 겪으셨다고 한 경우,",
                                            [
                                                ("기대한 대응과 실제 대응의 차이가 있었는지 확인", 0),
                                            ],
                                            0,
                                        ),
                                        branch(
                                            "큰 문제는 없었다고 하신 경우,",
                                            [
                                                ("가끔 불편했던 상황이 있었는지 가볍게 확인", 0),
                                            ],
                                            1,
                                        ),
                                    ],
                                    duration_sec=50,
                                ),
                                q(
                                    "question_11",
                                    "첫 달 청구서를 확인해 보셨나요? 요금 구조가 이해되었는지, 어렵거나 불신이 생긴 부분, 가입 시 안내와 달랐던 점이 있었는지 말씀해 주세요. 청구 전에 얼마 나올지 미리 확인해 보셨다면 언제·어떤 채널로 확인하셨는지도 알려 주세요.",
                                    [
                                        "청구 금액을 예상과 다르게 느낀 포인트가 있었는지 확인",
                                    ],
                                    duration_sec=45,
                                ),
                            ],
                        },
                    ],
                },
                {
                    "id": nid(),
                    "readable_id": "chapter_6",
                    "title": "우선순위·마무리",
                    "topics": [
                        {
                            "id": nid(),
                            "readable_id": "topic_1",
                            "title": "정리",
                            "questions": [
                                q(
                                    "question_12",
                                    "지금까지 이야기한 것 중에서 딱 한 가지만 고칠 수 있다면 무엇을 고치면 좋을까요? 이유와 함께 말씀해 주세요. 그리고 잠깐이라도 해지를 생각해 보신 순간이 있었다면 언제였고 무엇이 계기였는지도 알려 주세요.",
                                    [
                                        "한 가지를 꼽기 어렵다면 상위 두 가지까지 확인",
                                        "해지를 생각하지 않았다면 그 이유도 가볍게 확인",
                                    ],
                                    duration_sec=45,
                                ),
                            ],
                        }
                    ],
                },
            ],
            "interview_closing": {
                "closing_message": "오늘 소중한 시간 내어 주셔서 감사합니다. 추가로 하실 말씀이 있으시면 편하게 말씀해 주시고, 없으시면 '없습니다'라고 해 주셔도 됩니다. 감사합니다!"
            },
        }
    }

    OUT.write_text(json.dumps(survey, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

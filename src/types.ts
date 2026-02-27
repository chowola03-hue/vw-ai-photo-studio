export interface HistoryItem {
  id: number;
  name: string;
  dealer: string;
  showroom: string;
  background: string;
  image_front: string;
  image_side: string;
  image_full: string;
  created_at: string;
}

export const DEALERS = {
  "마이스터모터스": ["강남대치", "구로천왕", "인천"],
  "클라쎄오토": ["일산", "수원", "용산", "동대문", "구리", "해운대", "동래"],
  "아우토플라츠": ["송파", "판교", "분당", "안양", "원주", "대너", "천안"],
  "지오하우스": ["전주", "광주", "순천"],
  "지엔비오토모빌": ["대구", "창원"]
};

export const BACKGROUNDS = [
  { id: "solid", name: "단색", description: "깔끔한 라이트 그레이 스튜디오 배경" },
  { id: "logo", name: "로고 포함", description: "화이트 배경 우측 상단 폭스바겐 로고" },
  { id: "showroom", name: "전시장", description: "폭스바겐 전시장 내부와 차량 배경" }
];

export function inferMocktailPair(name: string, menuCategory: string) {
  if (menuCategory !== "soft-mocktail") return { base: "", mixer: "" };
  const value = name.replace(/[\s・]/g, "");
  const bases: Array<[RegExp, string]> = [
    [/カシスストロベリー/, "カシスストロベリー"],
    [/ピーチストロベリー/, "ピーチストロベリー"],
    [/カシス/, "カシス"],
    [/ストロベリー/, "ストロベリー"],
    [/ピーチ|ファジーネーブル|レゲエパンチ/, "ピーチ"],
    [/梅酒風/, "梅酒風"],
  ];
  const mixers: Array<[RegExp, string]> = [
    [/ウーロン/, "ウーロン茶"],
    [/グリーンティー|緑茶/, "緑茶"],
    [/オレンジ/, "オレンジ"],
    [/カルピス/, "カルピス"],
    [/コーラ|コーク/, "コーラ"],
    [/ソーダ/, "ソーダ"],
    [/ミルク/, "ミルク"],
    [/ラムネ/, "ラムネ"],
    [/水割り/, "水"],
    [/ロック/, "ロック／ストレート"],
  ];
  return {
    base: bases.find(([pattern]) => pattern.test(value))?.[1] ?? "",
    mixer: mixers.find(([pattern]) => pattern.test(value))?.[1] ?? "",
  };
}

export const MEMBER_RANKS=["STANDARD","BRONZE","SILVER","GOLD","PLATINUM","DIAMOND"] as const;
export type MemberRank=typeof MEMBER_RANKS[number];
export const rankLabels:Record<MemberRank,string>={STANDARD:"スタンダード",BRONZE:"ブロンズ",SILVER:"シルバー",GOLD:"ゴールド",PLATINUM:"プラチナ",DIAMOND:"ダイヤモンド"};

export function memberPresentation(storedRank:string|null){
 const resident=storedRank==="RESIDENT";
 const rank:MemberRank=resident?"GOLD":MEMBER_RANKS.includes(storedRank as MemberRank)?storedRank as MemberRank:"STANDARD";
 return{rank,rankLabel:rankLabels[rank],membershipType:resident?"RESIDENT":"GENERAL",membershipLabel:resident?"住民":null};
}

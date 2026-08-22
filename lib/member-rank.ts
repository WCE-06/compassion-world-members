export const MEMBER_RANKS=["STANDARD","BRONZE","SILVER","GOLD","PLATINUM","DIAMOND"] as const;
export type MemberRank=typeof MEMBER_RANKS[number];

export const RANK_RULES=[
 {rank:"STANDARD",label:"スタンダード",minimumSpend:0,pointRatePercent:1},
 {rank:"BRONZE",label:"ブロンズ",minimumSpend:30_000,pointRatePercent:2},
 {rank:"SILVER",label:"シルバー",minimumSpend:60_000,pointRatePercent:3},
 {rank:"GOLD",label:"ゴールド",minimumSpend:120_000,pointRatePercent:5},
 {rank:"PLATINUM",label:"プラチナ",minimumSpend:180_000,pointRatePercent:7},
 {rank:"DIAMOND",label:"ダイヤモンド",minimumSpend:300_000,pointRatePercent:10},
] as const satisfies readonly {rank:MemberRank;label:string;minimumSpend:number;pointRatePercent:number}[];

export const rankLabels=Object.fromEntries(RANK_RULES.map(rule=>[rule.rank,rule.label])) as Record<MemberRank,string>;

export function earnedRankForSpend(qualifyingSpend:number):MemberRank{
 const spend=Math.max(0,Math.floor(qualifyingSpend));
 return [...RANK_RULES].reverse().find(rule=>spend>=rule.minimumSpend)?.rank??"STANDARD";
}

export function memberPresentation(storedRank:string|null,qualifyingSpend=0){
 const resident=storedRank==="RESIDENT";
 const earnedRank=earnedRankForSpend(qualifyingSpend);
 const earnedIndex=MEMBER_RANKS.indexOf(earnedRank);
 const residentFloor=MEMBER_RANKS.indexOf("GOLD");
 const rank=MEMBER_RANKS[resident?Math.max(earnedIndex,residentFloor):earnedIndex];
 const rule=RANK_RULES.find(item=>item.rank===rank)??RANK_RULES[0];
 const nextRule=RANK_RULES[RANK_RULES.findIndex(item=>item.rank===rank)+1]??null;
 return{
  rank,rankLabel:rule.label,pointRatePercent:rule.pointRatePercent,
  qualifyingSpend:Math.max(0,Math.floor(qualifyingSpend)),
  nextRank:nextRule?.rank??null,nextRankLabel:nextRule?.label??null,
  amountToNextRank:nextRule?Math.max(0,nextRule.minimumSpend-Math.max(0,Math.floor(qualifyingSpend))):0,
  membershipType:resident?"RESIDENT":"GENERAL",membershipLabel:resident?"住民":null,
 };
}

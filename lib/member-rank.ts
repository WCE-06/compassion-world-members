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
export const MEMBER_RANK_TERMS_VERSION="2026-08-24-membership-points-v1";

export function rankIndex(rank:string|null|undefined){const index=MEMBER_RANKS.indexOf(rank as MemberRank);return index<0?0:index}
export function rankRule(rank:string|null|undefined){return RANK_RULES[rankIndex(rank)]??RANK_RULES[0]}

export function addRankYear(start:number){const date=new Date(start);date.setUTCFullYear(date.getUTCFullYear()+1);return date.getTime()}

export function rankPeriodFor(startedAt:number,now=Date.now()){
 let start=startedAt,end=addRankYear(startedAt)-1;
 while(now>end){start=end+1;end=addRankYear(start)-1}
 return{rankPeriodStartedAt:start,rankPeriodEndsAt:end,nextReviewAt:end+1};
}

export function effectiveRank(qualifyingSpend:number,residentPlanActive:boolean){
 const earned=earnedRankForSpend(qualifyingSpend),residentFloor=MEMBER_RANKS.indexOf("GOLD"),floorIndex=residentPlanActive?residentFloor:0;
 return MEMBER_RANKS[Math.max(rankIndex(earned),floorIndex)];
}

export function retainedRank(previousRank:string|null|undefined,qualifyingSpend:number,residentPlanActive:boolean,annualReview=false){
 const calculated=effectiveRank(qualifyingSpend,residentPlanActive);
 return annualReview?calculated:MEMBER_RANKS[Math.max(rankIndex(previousRank),rankIndex(calculated))];
}

export function earnedRankForSpend(qualifyingSpend:number):MemberRank{
 const spend=Math.max(0,Math.floor(qualifyingSpend));
 return [...RANK_RULES].reverse().find(rule=>spend>=rule.minimumSpend)?.rank??"STANDARD";
}

export function importedResidentStatus(value:string|null|undefined){
 const normalized=(value??"").trim().toUpperCase();
 if(!normalized)return "UNKNOWN" as const;
 if(normalized==="RESIDENT"||normalized==="住民会員"||normalized.includes("住民登録証"))return "ACTIVE" as const;
 if(normalized==="STANDARD"||normalized.includes("通行許可証"))return "INACTIVE" as const;
 return null;
}

export function memberPresentation(storedRank:string|null,qualifyingSpend=0,residentStatus:"UNKNOWN"|"ACTIVE"|"INACTIVE"="UNKNOWN",legacyResident=false){
 const resident=residentStatus==="ACTIVE"||storedRank==="RESIDENT"||legacyResident;
 const rank=retainedRank(storedRank,qualifyingSpend,resident,false);
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

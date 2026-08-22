// The business policy allows rewards down to a 0% final gross margin.
export const MINIMUM_MARGIN_BPS=0;

export function maximumPointRateBps(input:{sellingPriceExcludingTax:number;costExcludingTax:number;paymentFee?:number;minimumMarginBps?:number}){
 const sales=Math.max(0,input.sellingPriceExcludingTax),cost=Math.max(0,input.costExcludingTax),fee=Math.max(0,input.paymentFee??0),minimum=input.minimumMarginBps??MINIMUM_MARGIN_BPS;
 if(!sales)return 0;
 const requiredMargin=Math.ceil(sales*minimum/10_000),available=sales-cost-fee-requiredMargin;
 return Math.max(0,Math.floor(available*10_000/sales));
}

export function safePointRateBps(rankRateBps:number,input:Parameters<typeof maximumPointRateBps>[0]){return Math.min(Math.max(0,Math.floor(rankRateBps)),maximumPointRateBps(input))}

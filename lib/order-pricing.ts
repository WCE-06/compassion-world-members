export type PricedOrderItem = {
  product: { price: number; basePrice?: number; taxDivision?: string; taxRate?: number; taxRounding?: string };
  quantity: number;
};

function roundedTaxIncluded(basePrice:number,taxRate:number,taxRounding:string){
  const raw=basePrice*(100+taxRate)/100;
  return taxRounding==="0"?Math.round(raw):taxRounding==="2"?Math.ceil(raw):Math.floor(raw);
}

export function calculateOrderTotal(items:PricedOrderItem[]){
  let fixedTotal=0;
  const excludedGroups=new Map<string,{base:number;rate:number;rounding:string}>();
  for(const item of items){
    const quantity=Math.max(0,Math.floor(Number(item.quantity)||0)),product=item.product,division=String(product.taxDivision??"0");
    if(!quantity)continue;
    if(division==="1"){
      const rate=Number(product.taxRate??10),rounding=String(product.taxRounding??"1"),base=Number(product.basePrice);
      if(Number.isFinite(base)){
        const key=`${rate}:${rounding}`,group=excludedGroups.get(key)??{base:0,rate,rounding};
        group.base+=base*quantity;excludedGroups.set(key,group);continue;
      }
    }
    fixedTotal+=(division==="2"?Number(product.basePrice??product.price):Number(product.price))*quantity;
  }
  for(const group of excludedGroups.values())fixedTotal+=roundedTaxIncluded(group.base,group.rate,group.rounding);
  return Math.max(0,Math.round(fixedTotal));
}

import { NextRequest } from "next/server";
import { GET as getCatalog } from "../catalog/route";

export async function GET(request:NextRequest){
  return getCatalog(request);
}

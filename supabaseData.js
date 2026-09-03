(function(){
'use strict';
const client=window.CVTBenchSupabase;
if(!client)return;
async function active(table,order='name'){
  const {data,error}=await client.from(table).select('*').eq('is_active',true).order(order);
  return error?{success:false,data:[],error:error.message}:{success:true,data:data||[],error:null};
}
window.CVTBenchData={
  getScooters:()=>active('scooters','brand'),
  getCVTBrands:()=>active('cvt_brands','name'),
  getPulleySets:async brandId=>{let q=client.from('pulley_sets').select('*').eq('is_active',true).order('name');if(brandId)q=q.eq('brand_id',brandId);const {data,error}=await q;return error?{success:false,data:[],error:error.message}:{success:true,data:data||[],error:null};},
  getRidingGoals:()=>active('riding_goals','name'),
  getEngineClasses:()=>active('engine_classes','label'),
  async testConnection(){const {error}=await client.from('scooters').select('id').limit(1);return error?{success:false,error:error.message}:{success:true};}
};
client.from('scooters').select('id').limit(1).then(({error})=>{
  if(error) console.warn('CVT//BENCH: Supabase loaded, but database test failed:',error.message);
  else console.log('CVT//BENCH: Supabase database connection OK.');
});
})();

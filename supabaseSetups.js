(function(){
'use strict';
const client=window.CVTBenchSupabase;
if(!client)return;
async function user(){const {data}=await client.auth.getUser();return data.user||null;}
function errorMessage(e){return e&&e.message?e.message:'Database error.';}
window.CVTBenchSetups={
  async saveSetup(setup){
    const u=await user();
    if(!u)return {success:false,requiresLogin:true,error:'Please log in before saving a setup.'};
    const row={user_id:u.id,rider_weight:setup.riderKg||null,flyball_1:setup.flyball1||null,flyball_2:setup.flyball2||null,effective_flyball:setup.effFlyball||null,center_spring:setup.centerSpring||null,clutch_spring:setup.clutchSpring||null,calculated_rpm:setup.shiftRPM||null,verdict:setup.verdict||null,notes:setup.scooterLabel||null};
    const {data,error}=await client.from('saved_setups').insert(row).select().single();
    return error?{success:false,error:errorMessage(error)}:{success:true,data};
  },
  async getSavedSetups(){const u=await user();if(!u)return {success:false,requiresLogin:true,data:[]};const {data,error}=await client.from('saved_setups').select('*').eq('user_id',u.id).order('created_at',{ascending:false});return error?{success:false,data:[],error:errorMessage(error)}:{success:true,data:data||[]};},
  async deleteSetup(id){const u=await user();if(!u)return {success:false,requiresLogin:true};const {error}=await client.from('saved_setups').delete().eq('id',id).eq('user_id',u.id);return error?{success:false,error:errorMessage(error)}:{success:true};},
  async addHistory(action,setupData,savedSetupId=null){const u=await user();if(!u)return {success:false,requiresLogin:true};const {data,error}=await client.from('setup_history').insert({user_id:u.id,saved_setup_id:savedSetupId,action,setup_data:setupData}).select().single();return error?{success:false,error:errorMessage(error)}:{success:true,data};},
  async getHistory(){const u=await user();if(!u)return {success:false,requiresLogin:true,data:[]};const {data,error}=await client.from('setup_history').select('*').eq('user_id',u.id).order('created_at',{ascending:false});return error?{success:false,data:[],error:errorMessage(error)}:{success:true,data:data||[]};}
};
})();

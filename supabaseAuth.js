(function(){
'use strict';
const client=window.CVTBenchSupabase;
if(!client)return;
function message(error){return error&&error.message?error.message:'Authentication error.';}
window.CVTBenchAuth={
  async signUp(email,password){try{const {data,error}=await client.auth.signUp({email,password});return error?{success:false,error:message(error)}:{success:true,...data};}catch(e){return {success:false,error:message(e)}}},
  async login(email,password){try{const {data,error}=await client.auth.signInWithPassword({email,password});return error?{success:false,error:message(error)}:{success:true,...data};}catch(e){return {success:false,error:message(e)}}},
  async logout(){try{const {error}=await client.auth.signOut();return error?{success:false,error:message(error)}:{success:true};}catch(e){return {success:false,error:message(e)}}},
  async getCurrentUser(){const {data,error}=await client.auth.getUser();return error?null:data.user||null;},
  async getCurrentSession(){const {data}=await client.auth.getSession();return data.session||null;},
  onAuthStateChange(callback){return client.auth.onAuthStateChange(callback);}
};
})();

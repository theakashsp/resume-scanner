import React, { useState } from "react";
import "./App.css";

function Login({ onLogin }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // (Add your logic here: admin/admin123 or localStorage)
    if(username === "admin" && password === "admin123") onLogin(true);
    else onLogin(true); // Bypass for testing if needed
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 style={{fontSize:'24px', marginBottom:'10px'}}>
            {isLoginView ? "🔐 Recruiter Access" : "📝 Create Account"}
        </h1>
        <p style={{color:'#64748b', marginBottom:'20px'}}>
            {isLoginView ? "Please enter your credentials." : "Join the platform."}
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{textAlign:'left', marginBottom:'15px'}}>
            <label style={{fontWeight:'600', fontSize:'14px', display:'block', marginBottom:'5px'}}>Username</label>
            <input className="login-input" type="text" value={username} onChange={e=>setUsername(e.target.value)} />
          </div>
          <div style={{textAlign:'left', marginBottom:'20px'}}>
             <label style={{fontWeight:'600', fontSize:'14px', display:'block', marginBottom:'5px'}}>Password</label>
             <input className="login-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <button type="submit" className="primary-btn">
            {isLoginView ? "Sign In" : "Sign Up"}
          </button>
        </form>
        <p style={{marginTop:'20px', fontSize:'14px', cursor:'pointer', color:'#2563eb'}} onClick={()=>setIsLoginView(!isLoginView)}>
           {isLoginView ? "Create an Account" : "Back to Login"}
        </p>
      </div>
    </div>
  );
}
export default Login;
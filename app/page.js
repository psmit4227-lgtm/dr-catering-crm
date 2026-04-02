export default function Home() {
  return (
    <main style={{minHeight:"100vh", background:"#f9f8f5", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px", fontFamily:"Arial, sans-serif"}}>
      <div style={{background:"#ffffff", borderRadius:"16px", border:"1px solid #e8e6e0", width:"100%", maxWidth:"520px", padding:"36px"}}>
        
        <h1 style={{fontSize:"24px", fontWeight:"700", color:"#0f1214", margin:"0 0 6px"}}>New Order</h1>
        <p style={{fontSize:"13px", color:"#aaa", margin:"0 0 32px"}}>Fill this in during the call</p>

        <div style={{marginBottom:"20px"}}>
          <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>Client name</label>
          <input type="text" placeholder="Who is calling?" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none"}}/>
        </div>

        <div style={{marginBottom:"20px"}}>
          <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>Phone number</label>
          <input type="tel" placeholder="201-555-0000" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none"}}/>
        </div>

        <div style={{marginBottom:"20px"}}>
          <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>What do they want?</label>
          <textarea placeholder="e.g. 40 chicken skewers, 10 hummus platters" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none", height:"100px", resize:"none"}}/>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"20px"}}>
          <div>
            <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>Delivery date</label>
            <input type="date" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none"}}/>
          </div>
          <div>
            <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>Delivery time</label>
            <input type="time" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none"}}/>
          </div>
        </div>

        <div style={{marginBottom:"28px"}}>
          <label style={{display:"block", fontSize:"11px", fontWeight:"600", color:"#888", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px"}}>Delivery address</label>
          <input type="text" placeholder="Full address" style={{width:"100%", padding:"11px 14px", border:"1px solid #e8e6e0", borderRadius:"10px", fontSize:"14px", color:"#0f1214", boxSizing:"border-box", outline:"none"}}/>
        </div>

        <button style={{width:"100%", background:"#0f1214", color:"#ffffff", borderRadius:"10px", padding:"15px", fontSize:"15px", fontWeight:"600", border:"none", cursor:"pointer"}}>
          Save order
        </button>

      </div>
    </main>
  );
}
<!DOCTYPE html>
<html lang="bn" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,shrink-to-fit=no"/>
<title>SohojTech Pharmacy ERP</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"/>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg:#F0F4F9; --surface:#fff; --sidebar:#0D1B2A; --sidebar2:#162032;
  --accent:#1A6EBD; --accentH:#1559A0; --success:#198754; --danger:#DC3545;
  --warn:#E9A71A; --info:#0DCAF0; --text:#1C2B3A; --muted:#6B7A8D;
  --border:#D8E3F0; --hi:#EAF2FF; --sw:260px; --hh:62px;
  --r:10px; --shsm:0 2px 8px rgba(13,27,42,.07); --shmd:0 4px 20px rgba(13,27,42,.12);
  --fm:'Inter',system-ui,sans-serif; --mono:'JetBrains Mono',monospace; --tr:all .2s ease;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--fm);background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}

/* Loading */
#lo{position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#0D1B2A,#1A3A5C 60%,#1A6EBD);
  display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .5s,visibility .5s}
#lo.hide{opacity:0;visibility:hidden;pointer-events:none}
.lo-icon{width:80px;height:80px;border-radius:22px;background:rgba(255,255,255,.12);
  display:flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid rgba(255,255,255,.2)}
.lo-icon i{font-size:36px;color:#fff}
.lo-title{font-size:1.8rem;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:-.5px}
.lo-sub{font-size:.9rem;color:rgba(255,255,255,.55);margin-bottom:36px}
.spin{width:44px;height:44px;border-radius:50%;border:4px solid rgba(255,255,255,.15);
  border-top-color:#fff;animation:spin .9s linear infinite;margin-bottom:14px}
@keyframes spin{to{transform:rotate(360deg)}}
.lo-msg{font-size:.78rem;color:rgba(255,255,255,.45);font-family:var(--mono)}

/* DB Setup Modal */
#setupModal{position:fixed;inset:0;z-index:9998;background:rgba(13,27,42,.7);backdrop-filter:blur(6px);
  display:none;align-items:center;justify-content:center}
#setupModal.show{display:flex}
.setup-box{background:#fff;border-radius:16px;padding:36px 40px;max-width:520px;width:95%;box-shadow:var(--shmd)}
.setup-box h3{font-size:1.3rem;font-weight:700;color:var(--text);margin-bottom:6px}
.setup-box p{font-size:.85rem;color:var(--muted);margin-bottom:24px}
.setup-step{display:flex;gap:12px;margin-bottom:14px;padding:12px 14px;background:var(--hi);
  border-radius:8px;border:1px solid #C0D9F5;font-size:.84rem}
.step-num{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0}

/* Mini Spinner */
#ms{position:fixed;inset:0;z-index:8888;background:rgba(13,27,42,.45);backdrop-filter:blur(3px);
  display:none;align-items:center;justify-content:center}
#ms.on{display:flex}
.ms-box{background:#fff;border-radius:16px;padding:28px 40px;text-align:center;box-shadow:var(--shmd)}
.ms-box p{font-size:.9rem;color:var(--muted);margin-top:10px}

/* Toast */
#tc{position:fixed;bottom:24px;right:24px;z-index:9990;display:flex;flex-direction:column;gap:10px}
.toast{background:#fff;border-radius:10px;padding:14px 18px;box-shadow:0 6px 30px rgba(13,27,42,.18);
  min-width:260px;max-width:340px;display:flex;align-items:flex-start;gap:12px;
  border-left:4px solid var(--accent);animation:slideIn .3s ease}
.toast.s{border-left-color:var(--success)}.toast.d{border-left-color:var(--danger)}.toast.w{border-left-color:var(--warn)}
.toast i{margin-top:2px;font-size:1rem}.toast.s i{color:var(--success)}.toast.d i{color:var(--danger)}.toast.w i{color:var(--warn)}
.toast-msg{font-size:.84rem;font-weight:500;color:var(--text)}
@keyframes slideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}

/* Sidebar */
#sb{position:fixed;top:0;left:0;bottom:0;width:var(--sw);background:var(--sidebar);
  display:flex;flex-direction:column;z-index:1040;transition:transform .3s;overflow-y:auto}
#sb::-webkit-scrollbar{width:3px}#sb::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1)}
.sb-brand{padding:20px 18px 16px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:12px}
.sb-logo{width:42px;height:42px;border-radius:11px;background:var(--accent);
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-logo i{color:#fff;font-size:19px}
.sb-name{font-size:.95rem;font-weight:700;color:#fff;line-height:1.2}
.sb-sub{font-size:.68rem;color:rgba(255,255,255,.38);margin-top:1px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-sec{padding:16px 18px 5px;font-size:.63rem;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.27)}
.nav-item{list-style:none}
.nav-link{display:flex;align-items:center;gap:10px;padding:9px 18px;font-size:.86rem;font-weight:500;
  color:rgba(255,255,255,.6);cursor:pointer;transition:var(--tr);border-left:3px solid transparent;text-decoration:none}
.nav-link:hover{background:rgba(255,255,255,.06);color:#fff}
.nav-link.active{background:rgba(26,110,189,.25);color:#5AB4FF;border-left-color:var(--accent)}
.nav-link i{width:17px;text-align:center;font-size:.88rem}
.sb-foot{margin-top:auto;padding:14px 18px;border-top:1px solid rgba(255,255,255,.07)}
.sb-foot p{font-size:.68rem;color:rgba(255,255,255,.22)}
#sbo{display:none;position:fixed;inset:0;z-index:1039;background:rgba(0,0,0,.4)}
#sbo.show{display:block}

/* Header */
#hdr{position:fixed;top:0;left:var(--sw);right:0;height:var(--hh);background:#fff;
  border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;
  padding:0 22px;z-index:1030;box-shadow:var(--shsm)}
.hdr-l{display:flex;align-items:center;gap:12px}
.hdr-title{font-size:1rem;font-weight:600;color:var(--text)}
.hdr-r{display:flex;align-items:center;gap:10px}
.hbadge{background:var(--hi);color:var(--accent);border-radius:20px;padding:4px 11px;
  font-size:.73rem;font-weight:600;border:1px solid #C0D9F5}
.hbadge.g{background:#EAFAF1;color:var(--success);border-color:#A8E6C0}
.hbtn{background:none;border:1.5px solid var(--border);border-radius:8px;padding:6px 14px;
  font-size:.78rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  color:var(--text);transition:var(--tr);font-family:var(--fm)}
.hbtn:hover{border-color:var(--accent);color:var(--accent)}
.db-link-btn{background:var(--hi);border:1px solid #C0D9F5;border-radius:8px;padding:5px 12px;
  font-size:.76rem;font-weight:600;color:var(--accent);cursor:pointer;text-decoration:none;
  display:inline-flex;align-items:center;gap:6px;transition:var(--tr)}
.db-link-btn:hover{background:#d6e8ff}
.ham{display:none;background:none;border:none;font-size:1.2rem;color:var(--text);cursor:pointer;padding:4px}

/* Main */
#main{margin-left:var(--sw);padding-top:calc(var(--hh) + 22px);padding:calc(var(--hh) + 22px) 22px 40px;min-height:100vh}

/* Tabs */
.tab{display:none;animation:fadeIn .3s ease}
.tab.on{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.pg-hdr{margin-bottom:22px}
.pg-hdr h2{font-size:1.35rem;font-weight:700;color:var(--text)}
.pg-hdr p{font-size:.83rem;color:var(--muted);margin-top:2px}

/* Stat Cards */
.stat{background:#fff;border-radius:var(--r);border:1px solid var(--border);padding:18px 20px;
  box-shadow:var(--shsm);position:relative;overflow:hidden;transition:var(--tr)}
.stat:hover{transform:translateY(-2px);box-shadow:var(--shmd)}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent)}
.stat.bl::before{background:var(--accent)}.stat.gr::before{background:var(--success)}
.stat.or::before{background:var(--warn)}.stat.rd::before{background:var(--danger)}
.stat.tl::before{background:#00695C}.stat.pu::before{background:#6F42C1}
.sico{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;margin-bottom:12px}
.sico.bl{background:var(--hi);color:var(--accent)}.sico.gr{background:#EAFAF1;color:var(--success)}
.sico.or{background:#FEF9ED;color:var(--warn)}.sico.rd{background:#FFF0F0;color:var(--danger)}
.sico.tl{background:#E0F7FA;color:#00695C}.sico.pu{background:#F3EEFF;color:#6F42C1}
.sval{font-size:1.65rem;font-weight:800;line-height:1;margin-bottom:3px;font-family:var(--mono)}
.slbl{font-size:.76rem;color:var(--muted);font-weight:500}
.strd{font-size:.71rem;margin-top:6px}

/* Cards */
.card{background:#fff;border-radius:var(--r);border:1px solid var(--border);box-shadow:var(--shsm);overflow:hidden;margin-bottom:18px}
.card-hdr{padding:13px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;
  justify-content:space-between;background:#FAFCFF}
.card-hdr h5{font-size:.9rem;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;margin:0}
.card-hdr h5 i{color:var(--accent)}
.card-body{padding:18px}

/* Tables */
.tbl{width:100%;font-size:.81rem;border-collapse:collapse}
.tbl thead th{background:var(--hi);color:var(--accent);font-size:.71rem;font-weight:700;
  letter-spacing:.4px;text-transform:uppercase;padding:9px 11px;border-bottom:2px solid var(--border);white-space:nowrap}
.tbl tbody tr{border-bottom:1px solid var(--border);transition:var(--tr)}
.tbl tbody tr:hover{background:#F7FAFF}
.tbl tbody tr:last-child{border-bottom:none}
.tbl td{padding:9px 11px;vertical-align:middle}
.tw{overflow-x:auto;max-height:320px;overflow-y:auto}
.tw::-webkit-scrollbar{width:4px;height:4px}
.tw::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* Badges */
.bp{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600}
.bp.d{background:#FFF0F0;color:var(--danger);border:1px solid #FFC5C5}
.bp.w{background:#FEF9ED;color:#B07B00;border:1px solid #F5DBA0}
.bp.s{background:#EAFAF1;color:var(--success);border:1px solid #A8E6C0}
.bp.i{background:#E8FAFE;color:#0897C5;border:1px solid #A0E2EF}
.bp.m{background:#F2F4F7;color:var(--muted);border:1px solid var(--border)}
.bp.bl{background:var(--hi);color:var(--accent);border:1px solid #C0D9F5}
.bp.pu{background:#F3EEFF;color:#6F42C1;border:1px solid #D0B8FF}

/* Forms */
.flbl{font-size:.76rem;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;
  text-transform:uppercase;letter-spacing:.4px}
.fc,.fs{width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:7px;
  font-size:.86rem;font-family:var(--fm);color:var(--text);background:#fff;transition:var(--tr);outline:none}
.fc:focus,.fs:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(26,110,189,.1)}
.fc[readonly]{background:var(--bg);color:var(--muted)}
.fc.calc{background:var(--hi);color:var(--accent);font-weight:700;font-family:var(--mono);border-color:#C0D9F5}
.fc.dcalc{background:#FFF0F0;color:var(--danger);font-weight:700;font-family:var(--mono);border-color:#FFC5C5}
.fg{margin-bottom:14px}

/* ═══ SEARCHABLE DROPDOWN ═══ */
.sd-wrap{position:relative}
.sd-input-row{display:flex;gap:0;border:1.5px solid var(--border);border-radius:7px;overflow:hidden;background:#fff;transition:var(--tr)}
.sd-input-row:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(26,110,189,.1)}
.sd-search{flex:1;border:none;outline:none;padding:8px 12px;font-size:.86rem;font-family:var(--fm);color:var(--text);background:transparent}
.sd-chevron{padding:0 10px;display:flex;align-items:center;color:var(--muted);font-size:.75rem;cursor:pointer;border-left:1px solid var(--border);background:#FAFCFF;transition:var(--tr)}
.sd-chevron:hover{background:var(--hi);color:var(--accent)}
.sd-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--accent);
  border-radius:8px;box-shadow:0 8px 28px rgba(13,27,42,.18);z-index:5500;max-height:220px;overflow-y:auto;display:none}
.sd-dropdown.open{display:block}
.sd-dropdown::-webkit-scrollbar{width:4px}
.sd-dropdown::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.sd-opt{padding:9px 14px;font-size:.85rem;cursor:pointer;transition:background .15s;border-bottom:1px solid #F0F4F9;display:flex;align-items:center;gap:9px}
.sd-opt:last-child{border-bottom:none}
.sd-opt:hover,.sd-opt.highlighted{background:var(--hi)}
.sd-opt .sd-label{font-weight:600;color:var(--text)}
.sd-opt .sd-sub{font-size:.73rem;color:var(--muted)}
.sd-opt .sd-badge{margin-left:auto;flex-shrink:0}
.sd-empty{padding:14px;text-align:center;font-size:.82rem;color:var(--muted)}
.sd-selected{background:var(--hi);border:1.5px solid #C0D9F5;border-radius:7px;padding:7px 12px;
  display:flex;align-items:center;justify-content:space-between;font-size:.85rem;font-weight:600;color:var(--accent);margin-bottom:4px}
.sd-selected .sd-clear{cursor:pointer;color:var(--muted);font-size:.8rem;padding:2px 4px;border-radius:4px;transition:var(--tr)}
.sd-selected .sd-clear:hover{color:var(--danger);background:#FFF0F0}

/* Buttons */
.btn-p{background:var(--accent);color:#fff;border:none;padding:9px 20px;border-radius:8px;
  font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;
  gap:7px;transition:var(--tr);font-family:var(--fm)}
.btn-p:hover{background:var(--accentH);transform:translateY(-1px)}
.btn-p:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn-s{background:var(--success);color:#fff;border:none;padding:9px 20px;border-radius:8px;
  font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:var(--tr);font-family:var(--fm)}
.btn-s:hover{background:#157347;transform:translateY(-1px)}
.btn-d{background:var(--danger);color:#fff;border:none;padding:9px 20px;border-radius:8px;
  font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:var(--tr);font-family:var(--fm)}
.btn-d:hover{background:#B02A37;transform:translateY(-1px)}
.btn-o{background:#fff;color:var(--accent);border:1.5px solid var(--accent);padding:9px 20px;border-radius:8px;
  font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:var(--tr);font-family:var(--fm)}
.btn-o:hover{background:var(--hi)}
.btn-sm{padding:5px 12px;font-size:.78rem}
.btn-icon{width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:#fff;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;transition:var(--tr)}
.btn-icon:hover{background:var(--hi);border-color:var(--accent);color:var(--accent)}
.btn-icon.del:hover{background:#FFF0F0;border-color:var(--danger);color:var(--danger)}
.r-star{color:var(--danger);margin-left:2px}

/* Info Strip */
.istrip{background:var(--hi);border:1px solid #C0D9F5;border-radius:8px;padding:10px 14px;
  display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px}
.ii{display:flex;flex-direction:column}
.ii span:first-child{font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}
.ii span:last-child{font-size:.92rem;font-weight:700;color:var(--text);font-family:var(--mono);margin-top:1px}
.ii .ew{color:var(--danger)!important}.ii .lw{color:var(--warn)!important}

/* Inline Alerts */
.ia{border-radius:8px;padding:9px 13px;font-size:.81rem;font-weight:500;margin-bottom:14px;
  display:none;align-items:center;gap:7px}
.ia.show{display:flex}
.ia.d{background:#FFF0F0;color:var(--danger);border:1px solid #FFC5C5}
.ia.s{background:#EAFAF1;color:var(--success);border:1px solid #A8E6C0}
.ia.w{background:#FEF9ED;color:#8B6000;border:1px solid #F5DBA0}

/* Bill Summary */
.bill-box{background:var(--sidebar);border-radius:var(--r);padding:18px;color:#fff}
.bill-box h6{font-size:.72rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px}
.bill-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;
  border-bottom:1px solid rgba(255,255,255,.07);font-size:.86rem}
.bill-row:last-child{border:none}
.bill-row.tot{font-size:1rem;font-weight:700;padding-top:10px;margin-top:3px;border:none}
.bill-row span:last-child{font-family:var(--mono);font-weight:600}
.bill-row.tot span:last-child{color:#5AB4FF;font-size:1.1rem}
.bill-row.due-r span:last-child{color:#FF7F7F}

/* Due Ledger Rows */
.due-row-item{background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 16px;
  margin-bottom:9px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;transition:var(--tr)}
.due-row-item:hover{box-shadow:var(--shsm);border-color:#B0CAEB}
.di-info h6{font-size:.88rem;font-weight:600;margin:0 0 2px}
.di-info p{font-size:.76rem;color:var(--muted);margin:0}
.di-due{font-size:1rem;font-weight:800;color:var(--danger);font-family:var(--mono)}

/* Purchase Item Row */
.pur-item{background:#FAFCFF;border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;position:relative}
.pur-item-del{position:absolute;top:10px;right:10px}

/* Empty State */
.empty{text-align:center;padding:32px 16px;color:var(--muted)}
.empty i{font-size:2.2rem;opacity:.28;margin-bottom:9px;display:block}
.empty p{font-size:.83rem}

/* Divider */
.divider{height:1px;background:var(--border);margin:20px 0}

/* Modal */
.modal-custom{position:fixed;inset:0;z-index:5000;background:rgba(13,27,42,.6);backdrop-filter:blur(4px);
  display:none;align-items:center;justify-content:center;padding:16px}
.modal-custom.show{display:flex}
.modal-box{background:#fff;border-radius:14px;padding:28px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shmd)}
.modal-box h4{font-size:1.1rem;font-weight:700;margin-bottom:16px;color:var(--text)}
.modal-close{float:right;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted)}

/* ═══ DASHBOARD ENHANCEMENTS ═══ */
.dash-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px}
.kpi-card{background:#fff;border-radius:10px;border:1px solid var(--border);padding:15px 16px;
  box-shadow:var(--shsm);position:relative;overflow:hidden;transition:var(--tr)}
.kpi-card:hover{transform:translateY(-2px);box-shadow:var(--shmd)}
.kpi-card .kpi-top{display:flex;align-items:flex-start;justify-content:space-between}
.kpi-card .kpi-ico{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.kpi-card .kpi-val{font-size:1.4rem;font-weight:800;font-family:var(--mono);margin:8px 0 2px}
.kpi-card .kpi-lbl{font-size:.72rem;color:var(--muted);font-weight:500}
.kpi-card .kpi-trend{font-size:.69rem;margin-top:5px;font-weight:600}
.kpi-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px}
.kpi-card.blue::after{background:var(--accent)}.kpi-card.green::after{background:var(--success)}
.kpi-card.red::after{background:var(--danger)}.kpi-card.orange::after{background:var(--warn)}
.kpi-card.teal::after{background:#00695C}.kpi-card.purple::after{background:#6F42C1}

/* Mini Progress Bar */
.mini-prog{height:5px;background:#eee;border-radius:10px;margin-top:7px;overflow:hidden}
.mini-prog-fill{height:100%;border-radius:10px;transition:width .6s ease}

/* Ledger Table (income/expense) */
.led-type-in{color:var(--success);font-weight:700}
.led-type-out{color:var(--danger);font-weight:700}
.led-type-tab{display:flex;gap:0;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px}
.led-type-tab button{flex:1;border:none;padding:7px 0;font-size:.8rem;font-weight:600;cursor:pointer;transition:var(--tr);background:#fff;color:var(--muted)}
.led-type-tab button.active{background:var(--accent);color:#fff}
.led-type-tab button:first-child{border-right:1px solid var(--border)}

/* Summary mini chart */
.summary-bar-wrap{display:flex;gap:8px;align-items:center;margin-bottom:6px}
.summary-bar-label{font-size:.74rem;color:var(--muted);width:80px;flex-shrink:0}
.summary-bar-outer{flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden}
.summary-bar-inner{height:100%;border-radius:4px;transition:width .6s}
.summary-bar-val{font-size:.75rem;font-weight:700;font-family:var(--mono);width:70px;text-align:right;flex-shrink:0}

/* Responsive */
@media(max-width:991px){
  #sb{transform:translateX(-100%)}#sb.open{transform:translateX(0)}
  #main{margin-left:0;padding-left:14px;padding-right:14px}
  #hdr{left:0}.ham{display:block}
}
@media(max-width:767px){.sval{font-size:1.35rem}.kpi-val{font-size:1.1rem!important}}

/* Utility */
.mono{font-family:var(--mono)}.fw7{font-weight:700}.text-p{color:var(--accent)}.text-s{color:var(--success)}
.text-d{color:var(--danger)}.text-w{color:var(--warn)}.text-m{color:var(--muted)}
.d-none{display:none!important}
</style>
</head>
<body>

<!-- ══ LOADING OVERLAY ══ -->
<div id="lo">
  <div class="lo-icon"><i class="fa-solid fa-pills"></i></div>
  <div class="lo-title">SohojTech ফার্মা-ইআরপি</div>
  <div class="lo-sub">ফার্মেসি ম্যানেজমেন্ট সিস্টেম</div>
  <div class="spin"></div>
  <div class="lo-msg" id="loMsg">সিস্টেম লোড হচ্ছে...</div>
</div>

<!-- ══ DB SETUP MODAL ══ -->
<div id="setupModal">
  <div class="setup-box">
    <button class="modal-close" onclick="closeSetupModal()">✕</button>
    <h3><i class="fa-solid fa-database me-2" style="color:var(--accent)"></i>ডেটাবেস সংযোগ করুন</h3>
    <p>প্রথমবার ব্যবহারের আগে আপনার Google Spreadsheet-এর সাথে সংযোগ করুন।</p>
    <div class="setup-step"><div class="step-num">১</div><div>Google Drive-এ একটি নতুন Spreadsheet তৈরি করুন</div></div>
    <div class="setup-step"><div class="step-num">২</div><div>URL থেকে <strong>/d/</strong> এর পরের অংশটি কপি করুন</div></div>
    <div class="setup-step"><div class="step-num">৩</div><div>নিচে পেস্ট করুন ও "সংযোগ করুন" চাপুন</div></div>
    <div class="fg mt-3">
      <label class="flbl">Spreadsheet ID (ঐচ্ছিক)</label>
      <input type="text" class="fc" id="ssIdInput" placeholder="1KyXILgtIC4o0A5C3tdwU_EKkKv4nd3oGGu34hvcoDTo"/>
    </div>
    <div class="ia d" id="setupError"><i class="fa-solid fa-circle-exclamation"></i><span id="setupErrorMsg"></span></div>
    <button class="btn-p w-100 mt-2" onclick="doConnect()">
      <i class="fa-solid fa-plug"></i> সংযোগ করুন / স্বয়ংক্রিয় তৈরি করুন
    </button>
  </div>
</div>

<!-- ══ MINI SPINNER ══ -->
<div id="ms"><div class="ms-box">
  <div class="spin" style="width:34px;height:34px;border-top-color:var(--accent);border-color:var(--border);margin:0 auto"></div>
  <p id="msMsg">প্রক্রিয়াকরণ চলছে...</p>
</div></div>

<!-- ══ TOAST ══ -->
<div id="tc"></div>

<!-- ══ EDIT MODAL ══ -->
<div class="modal-custom" id="editModal">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('editModal')">✕</button>
    <h4 id="editModalTitle">এডিট করুন</h4>
    <div id="editModalBody"></div>
    <div class="d-flex gap-2 mt-3">
      <button class="btn-p flex-grow-1" onclick="submitEdit()"><i class="fa-solid fa-check"></i> সংরক্ষণ করুন</button>
      <button class="btn-o" onclick="closeModal('editModal')">বাতিল</button>
    </div>
  </div>
</div>

<!-- ══ SIDEBAR OVERLAY ══ -->
<div id="sbo" onclick="closeSb()"></div>

<!-- ══ SIDEBAR ══ -->
<nav id="sb">
  <div class="sb-brand">
    <div class="sb-logo"><i class="fa-solid fa-pills"></i></div>
    <div>
      <div class="sb-name">ফার্মা-ইআরপি</div>
      <div class="sb-sub" id="pharmaName">লোড হচ্ছে...</div>
    </div>
  </div>
  <div class="sb-sec">মূল মেনু</div>
  <ul class="list-unstyled px-0">
    <li class="nav-item"><a class="nav-link active" onclick="goTab('dashboard')" data-tab="dashboard"><i class="fa-solid fa-gauge-high"></i> ড্যাশবোর্ড</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('pos')" data-tab="pos"><i class="fa-solid fa-cash-register"></i> বিক্রয় (POS)</a></li>
  </ul>
  <div class="sb-sec">ব্যবস্থাপনা</div>
  <ul class="list-unstyled px-0">
    <li class="nav-item"><a class="nav-link" onclick="goTab('medicine')" data-tab="medicine"><i class="fa-solid fa-capsules"></i> ওষুধ মাস্টার</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('inventory')" data-tab="inventory"><i class="fa-solid fa-boxes-stacked"></i> ইনভেন্টরি</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('purchase')" data-tab="purchase"><i class="fa-solid fa-truck-field"></i> ক্রয়</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('opening')" data-tab="opening"><i class="fa-solid fa-clock-rotate-left"></i> পূর্বের হিসাব</a></li>
  </ul>
  <div class="sb-sec">হিসাব</div>
  <ul class="list-unstyled px-0">
    <li class="nav-item"><a class="nav-link" onclick="goTab('customers')" data-tab="customers"><i class="fa-solid fa-users"></i> গ্রাহক</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('suppliers')" data-tab="suppliers"><i class="fa-solid fa-building"></i> সরবরাহকারী</a></li>
    <li class="nav-item"><a class="nav-link" onclick="goTab('accounts')" data-tab="accounts"><i class="fa-solid fa-book-open"></i> অ্যাকাউন্টস</a></li>
  </ul>
  <div class="sb-sec">সেটিংস</div>
  <ul class="list-unstyled px-0">
    <li class="nav-item"><a class="nav-link" onclick="goTab('settings')" data-tab="settings"><i class="fa-solid fa-gear"></i> সেটিংস</a></li>
  </ul>
  <div class="sb-foot"><p>ফার্মা-ইআরপি v4.1 &copy; 2026</p></div>
</nav>

<!-- ══ HEADER ══ -->
<header id="hdr">
  <div class="hdr-l">
    <button class="ham" onclick="toggleSb()"><i class="fa-solid fa-bars"></i></button>
    <div class="hdr-title" id="hdrTitle">ড্যাশবোর্ড</div>
  </div>
  <div class="hdr-r">
    <span class="hbadge g" id="connStatus"><i class="fa-solid fa-circle me-1"></i>সংযুক্ত</span>
    <a id="dbLinkBtn" class="db-link-btn" href="#" target="_blank"><i class="fa-solid fa-table-cells"></i> Spreadsheet</a>
    <button class="hbtn" onclick="refreshAll()"><i class="fa-solid fa-rotate-right"></i> রিফ্রেশ</button>
    <button class="hbtn" onclick="showSetupModal()"><i class="fa-solid fa-plug"></i> DB</button>
  </div>
</header>

<!-- ══ MAIN ══ -->
<main id="main">

<!-- ════ DASHBOARD ════ -->
<div id="tab-dashboard" class="tab on">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-gauge-high me-2" style="color:var(--accent)"></i>ড্যাশবোর্ড</h2>
    <p id="dashDate">আজকের সারসংক্ষেপ ও ব্যবসায়িক অবস্থান</p>
  </div>

  <!-- KPI Grid — 6 cards -->
  <div class="dash-kpi-grid" id="dashKpiGrid">
    <!-- filled by JS -->
  </div>

  <!-- Row 1: Today's P&L + Stock summary -->
  <div class="row g-3 mb-3">
    <div class="col-lg-4">
      <div class="card h-100">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-scale-balanced"></i> আজকের আয়-ব্যয় সারাংশ</h5>
        </div>
        <div class="card-body" id="dashPLSummary">
          <div class="empty"><i class="fa-solid fa-chart-pie"></i><p>লোড হচ্ছে...</p></div>
        </div>
      </div>
    </div>
    <div class="col-lg-4">
      <div class="card h-100">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-boxes-stacked"></i> স্টক অবস্থা</h5>
        </div>
        <div class="card-body" id="dashStockSummary">
          <div class="empty"><i class="fa-solid fa-boxes-stacked"></i><p>লোড হচ্ছে...</p></div>
        </div>
      </div>
    </div>
    <div class="col-lg-4">
      <div class="card h-100">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-money-bill-trend-up"></i> বকেয়া সংক্ষেপ</h5>
        </div>
        <div class="card-body" id="dashDueSummary">
          <div class="empty"><i class="fa-solid fa-users"></i><p>লোড হচ্ছে...</p></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Row 2: Expiry + Low Stock Alerts -->
  <div class="row g-3 mb-3">
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-triangle-exclamation"></i> মেয়াদ সতর্কতা (৯০ দিন)</h5>
          <span class="bp w" id="expiryCount">লোড...</span>
        </div>
        <div class="tw"><table class="tbl">
          <thead><tr><th>ওষুধ</th><th>স্টক</th><th>মেয়াদ</th><th>অবস্থা</th></tr></thead>
          <tbody id="expiryTbody"><tr><td colspan="4"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো সতর্কতা নেই</p></div></td></tr></tbody>
        </table></div>
      </div>
    </div>
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-arrow-trend-down"></i> স্বল্প স্টক সতর্কতা</h5>
          <span class="bp d" id="lowStockCount">লোড...</span>
        </div>
        <div class="tw"><table class="tbl">
          <thead><tr><th>ওষুধ</th><th>বর্তমান স্টক</th><th>অবস্থা</th></tr></thead>
          <tbody id="lowStockTbody"><tr><td colspan="3"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>স্টক স্বাভাবিক</p></div></td></tr></tbody>
        </table></div>
      </div>
    </div>
  </div>

  <!-- Row 3: Due customers + Recent sales -->
  <div class="row g-3">
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-users"></i> শীর্ষ বাকি গ্রাহক</h5>
          <button class="btn-o btn-sm" onclick="goTab('accounts')">সব দেখুন</button>
        </div>
        <div class="card-body" id="dashDueList"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো বকেয়া নেই</p></div></div>
      </div>
    </div>
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-receipt"></i> আজকের সাম্প্রতিক বিক্রয়</h5>
          <button class="btn-o btn-sm" onclick="goTab('pos')">POS খুলুন</button>
        </div>
        <div class="tw" style="max-height:260px">
          <table class="tbl"><thead><tr><th>Invoice</th><th>গ্রাহক</th><th>মোট</th><th>বাকি</th></tr></thead>
          <tbody id="dashRecentSales"><tr><td colspan="4"><div class="empty" style="padding:14px"><i class="fa-solid fa-receipt"></i><p>আজ কোনো বিক্রয় নেই</p></div></td></tr></tbody></table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /dashboard -->


<!-- ════ POS ════ -->
<div id="tab-pos" class="tab">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-cash-register me-2" style="color:var(--accent)"></i>বিক্রয় (POS)</h2>
    <p>দ্রুত বিলিং ডেস্ক</p>
  </div>
  <div class="row g-3">
    <div class="col-lg-7">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-file-invoice"></i> নতুন বিক্রয় বিল</h5>
          <button class="btn-d btn-sm" onclick="clearPOS()"><i class="fa-solid fa-rotate-left"></i> রিসেট</button>
        </div>
        <div class="card-body">
          <div class="ia d" id="posErr"><i class="fa-solid fa-circle-exclamation"></i><span id="posErrMsg"></span></div>
          <div class="row g-2 mb-2">
            <div class="col-md-6">
              <div class="fg">
                <label class="flbl">গ্রাহক <span class="r-star">*</span></label>
                <div id="sdPosCust"></div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="fg"><label class="flbl">তারিখ</label>
                <input type="date" class="fc" id="posDate"/>
              </div>
            </div>
          </div>
          <div id="posItems"></div>
          <button class="btn-o btn-sm mb-3" onclick="addPOSItem()"><i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন</button>
          <div class="row g-2">
            <div class="col-4"><div class="fg"><label class="flbl">মোট (৳)</label><input type="text" class="fc calc" id="posTotalBill" readonly/></div></div>
            <div class="col-4"><div class="fg"><label class="flbl">নগদ (৳) <span class="r-star">*</span></label><input type="number" class="fc" id="posCash" min="0" placeholder="০" oninput="calcDue()"/></div></div>
            <div class="col-4"><div class="fg"><label class="flbl">বাকি (৳)</label><input type="text" class="fc dcalc" id="posDue" readonly/></div></div>
          </div>
          <button class="btn-p w-100 mt-1" id="posSubmitBtn" onclick="submitPOS()"><i class="fa-solid fa-check-circle"></i> বিক্রয় নিশ্চিত করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-5">
      <div class="bill-box mb-3">
        <h6><i class="fa-solid fa-receipt me-2"></i>বিল সারসংক্ষেপ</h6>
        <div class="bill-row"><span>মোট ওষুধ</span><span id="bMed">৳০.০০</span></div>
        <div class="bill-row"><span>মোট ডিসকাউন্ট</span><span id="bDisc">৳০.০০</span></div>
        <div class="bill-row tot"><span>মোট দেয়</span><span id="bTotal">৳০.০০</span></div>
        <div class="bill-row"><span>নগদ</span><span id="bCash">৳০.০০</span></div>
        <div class="bill-row due-r"><span>বাকি</span><span id="bDue">৳০.০০</span></div>
      </div>
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-clock-rotate-left"></i> আজকের বিক্রয়</h5></div>
        <div class="tw" style="max-height:280px">
          <table class="tbl"><thead><tr><th>Invoice</th><th>গ্রাহক</th><th>ওষুধ</th><th>মোট</th><th>বাকি</th><th></th></tr></thead>
          <tbody id="todaySalesTbody"><tr><td colspan="6"><div class="empty" style="padding:16px"><i class="fa-solid fa-file-invoice"></i><p>কোনো বিক্রয় নেই</p></div></td></tr></tbody></table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /pos -->


<!-- ════ MEDICINE MASTER ════ -->
<div id="tab-medicine" class="tab">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-capsules me-2" style="color:var(--accent)"></i>ওষুধ মাস্টার</h2>
    <p>ওষুধ নিবন্ধন ও ব্যবস্থাপনা</p>
  </div>
  <div class="row g-3">
    <div class="col-lg-5">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-plus-circle"></i> নতুন ওষুধ যোগ করুন</h5></div>
        <div class="card-body">
          <div class="ia s" id="medOk"><i class="fa-solid fa-circle-check"></i> ওষুধ যোগ হয়েছে!</div>
          <div class="ia d" id="medErr"><i class="fa-solid fa-circle-xmark"></i><span id="medErrMsg"></span></div>
          <div class="row g-2">
            <div class="col-6"><div class="fg"><label class="flbl">ব্র্যান্ড নাম <span class="r-star">*</span></label><input type="text" class="fc" id="mBrand" placeholder="যেমন: Napa"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">জেনেরিক নাম</label><input type="text" class="fc" id="mGeneric" placeholder="Paracetamol"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">ডোজ ফর্ম <span class="r-star">*</span></label>
              <select class="fs" id="mDose"><option>ট্যাবলেট</option><option>ক্যাপসুল</option><option>সিরাপ</option><option>ইনজেকশন</option><option>ড্রপ</option><option>অয়েন্টমেন্ট</option><option>অন্যান্য</option></select>
            </div></div>
            <div class="col-6"><div class="fg"><label class="flbl">শক্তি/Strength</label><input type="text" class="fc" id="mStr" placeholder="500mg"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">প্রস্তুতকারক</label><input type="text" class="fc" id="mMfr" placeholder="Square"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">ক্যাটাগরি</label>
              <select class="fs" id="mCat"><option>এন্টিবায়োটিক</option><option>এনালজেসিক</option><option>এন্টাসিড</option><option>ভিটামিন</option><option>অ্যান্টিহিস্টামিন</option><option>অন্যান্য</option></select>
            </div></div>
            <div class="col-6"><div class="fg"><label class="flbl">ইউনিট</label><input type="text" class="fc" id="mUnit" value="পাতা"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">রি-অর্ডার লেভেল</label><input type="number" class="fc" id="mReorder" value="10" min="0"/></div></div>
          </div>
          <button class="btn-p w-100 mt-2" onclick="submitMedicine()"><i class="fa-solid fa-plus-circle"></i> ওষুধ যোগ করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-7">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-list-ul"></i> ওষুধ তালিকা</h5>
          <div class="d-flex gap-2 align-items-center">
            <input type="text" class="fc" style="width:180px;padding:5px 10px;font-size:.8rem" placeholder="খুঁজুন..." id="medSearch" oninput="filterMedicines()"/>
            <span class="bp bl" id="medCount">লোড...</span>
          </div>
        </div>
        <div class="tw" style="max-height:420px">
          <table class="tbl" id="medTable">
            <thead><tr><th>ID</th><th>ব্র্যান্ড</th><th>জেনেরিক</th><th>ফর্ম</th><th>শক্তি</th><th>ক্যাটাগরি</th><th>রি-অর্ডার</th><th>Action</th></tr></thead>
            <tbody id="medTbody"><tr><td colspan="8"><div class="empty"><i class="fa-solid fa-capsules"></i><p>কোনো ওষুধ নেই</p></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /medicine -->


<!-- ════ INVENTORY ════ -->
<div id="tab-inventory" class="tab">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-boxes-stacked me-2" style="color:var(--accent)"></i>ইনভেন্টরি</h2>
    <p>ব্যাচ-ভিত্তিক স্টক ব্যবস্থাপনা (FEFO)</p>
  </div>
  <div class="row g-3 mb-3">
    <div class="col-6 col-md-3"><div class="stat bl"><div class="sico bl"><i class="fa-solid fa-pills"></i></div><div class="sval text-p" id="invTotal">০</div><div class="slbl">মোট ওষুধ</div></div></div>
    <div class="col-6 col-md-3"><div class="stat or"><div class="sico or"><i class="fa-solid fa-box-open"></i></div><div class="sval" style="color:var(--warn)" id="invLow">০</div><div class="slbl">স্বল্প স্টক</div></div></div>
    <div class="col-6 col-md-3"><div class="stat rd"><div class="sico rd"><i class="fa-solid fa-ban"></i></div><div class="sval text-d" id="invOut">০</div><div class="slbl">স্টকশূন্য</div></div></div>
    <div class="col-6 col-md-3"><div class="stat gr"><div class="sico gr"><i class="fa-solid fa-money-bill-trend-up"></i></div><div class="sval text-s" id="invMRP">৳০</div><div class="slbl">MRP মূল্য</div></div></div>
  </div>
  <div class="card">
    <div class="card-hdr">
      <h5><i class="fa-solid fa-table-list"></i> স্টক সারসংক্ষেপ</h5>
      <input type="text" class="fc" style="width:180px;padding:5px 10px;font-size:.8rem" placeholder="ওষুধ খুঁজুন..." id="invSearch" oninput="filterInventory()"/>
    </div>
    <div class="tw" style="max-height:500px">
      <table class="tbl">
        <thead><tr><th>ব্র্যান্ড</th><th>ফর্ম</th><th>শক্তি</th><th>মোট স্টক</th><th>নিকটতম মেয়াদ</th><th>Cost মূল্য</th><th>MRP মূল্য</th><th>অবস্থা</th><th>Action</th></tr></thead>
        <tbody id="invTbody"><tr><td colspan="9"><div class="empty"><i class="fa-solid fa-boxes-stacked"></i><p>কোনো স্টক নেই</p></div></td></tr></tbody>
      </table>
    </div>
  </div>
</div><!-- /inventory -->


<!-- ════ PURCHASE ════ -->
<div id="tab-purchase" class="tab">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-truck-field me-2" style="color:var(--accent)"></i>ক্রয়</h2>
    <p>সরবরাহকারীর কাছ থেকে ওষুধ ক্রয় ও স্টক আপডেট</p>
  </div>
  <div class="row g-3">
    <div class="col-lg-5">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-cart-flatbed"></i> নতুন ক্রয় এন্ট্রি</h5></div>
        <div class="card-body">
          <div class="ia s" id="purOk"><i class="fa-solid fa-circle-check"></i><span id="purOkMsg">ক্রয় রেকর্ড হয়েছে!</span></div>
          <div class="ia d" id="purErr"><i class="fa-solid fa-circle-xmark"></i><span id="purErrMsg"></span></div>
          <div class="row g-2">
            <div class="col-6">
              <div class="fg">
                <label class="flbl">সরবরাহকারী <span class="r-star">*</span></label>
                <div id="sdPurSup"></div>
              </div>
            </div>
            <div class="col-6"><div class="fg"><label class="flbl">তারিখ <span class="r-star">*</span></label><input type="date" class="fc" id="purDate"/></div></div>
            <div class="col-12"><div class="fg"><label class="flbl">পেমেন্ট ধরন</label>
              <select class="fs" id="purPayType" onchange="onPurPayTypeChange()"><option value="নগদ">নগদ</option><option value="বাকি">বাকি</option></select>
            </div></div>
          </div>
          <div id="purItems"></div>
          <button class="btn-o btn-sm mb-3" onclick="addPurItem()"><i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন</button>
          <div class="fg" id="purPaidBox" style="display:none">
            <label class="flbl">এখন পরিশোধ (৳)</label>
            <input type="number" class="fc" id="purPaid" min="0" placeholder="০"/>
          </div>
          <button class="btn-p w-100 mt-1" onclick="submitPurchase()"><i class="fa-solid fa-boxes-packing"></i> ক্রয় নিশ্চিত করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-7">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-clock-rotate-left"></i> ক্রয় লগ</h5>
          <span class="bp bl" id="purCount">লোড...</span>
        </div>
        <div class="tw" style="max-height:450px">
          <table class="tbl">
            <thead><tr><th>তারিখ</th><th>Invoice</th><th>সরবরাহকারী</th><th>ওষুধ</th><th>Qty</th><th>মূল্য</th><th>মোট</th><th>Action</th></tr></thead>
            <tbody id="purTbody"><tr><td colspan="8"><div class="empty"><i class="fa-solid fa-truck-field"></i><p>কোনো ক্রয় নেই</p></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /purchase -->


<!-- ════ OPENING BALANCE ════ -->
<div id="tab-opening" class="tab">
  <div class="pg-hdr">
    <h2><i class="fa-solid fa-clock-rotate-left me-2" style="color:var(--accent)"></i>পূর্বের হিসাব</h2>
    <p>ব্যবসা শুরুর আগের স্টক, বাকি ও নগদ</p>
  </div>
  <div class="row g-3">
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-plus-circle"></i> নতুন Opening এন্ট্রি</h5></div>
        <div class="card-body">
          <div class="ia s" id="obOk"><i class="fa-solid fa-circle-check"></i><span id="obOkMsg">এন্ট্রি সংরক্ষিত হয়েছে!</span></div>
          <div class="ia d" id="obErr"><i class="fa-solid fa-circle-xmark"></i><span id="obErrMsg"></span></div>
          <div class="fg"><label class="flbl">ক্যাটাগরি <span class="r-star">*</span></label>
            <select class="fs" id="obCat" onchange="onObCatChange()">
              <option value="স্টক">স্টক (ওষুধ)</option>
              <option value="নগদ">নগদ / ব্যাংক</option>
              <option value="গ্রাহক বাকি">গ্রাহক বাকি</option>
              <option value="সরবরাহকারী বাকি">সরবরাহকারী বাকি</option>
              <option value="অন্যান্য সম্পদ">অন্যান্য সম্পদ</option>
              <option value="দায়">দায় / লোন</option>
            </select>
          </div>
          <div id="obStockFields">
            <div class="row g-2">
              <div class="col-12"><div class="fg"><label class="flbl">ওষুধ নির্বাচন <span class="r-star">*</span></label>
                <div id="sdObMed"></div>
              </div></div>
              <div class="istrip" id="obMedStrip" style="display:none">
                <div class="ii"><span>ID</span><span id="obMedId">—</span></div>
                <div class="ii"><span>ডোজ ফর্ম</span><span id="obMedDose">—</span></div>
                <div class="ii"><span>শক্তি</span><span id="obMedStr">—</span></div>
              </div>
              <div class="col-6"><div class="fg"><label class="flbl">পরিমাণ (Qty)</label><input type="number" class="fc" id="obQty" min="1" placeholder="০"/></div></div>
              <div class="col-6"><div class="fg"><label class="flbl">ক্রয় মূল্য (৳)</label><input type="number" class="fc" id="obCostPrice" min="0" placeholder="০.০০"/></div></div>
              <div class="col-6"><div class="fg"><label class="flbl">MRP (৳)</label><input type="number" class="fc" id="obMRP" min="0" placeholder="০.০০"/></div></div>
              <div class="col-6"><div class="fg"><label class="flbl">বিক্রয় মূল্য (৳)</label><input type="number" class="fc" id="obSellPrice" min="0" placeholder="০.০০"/></div></div>
              <div class="col-6"><div class="fg"><label class="flbl">মেয়াদ (MM/YYYY)</label><input type="text" class="fc" id="obExpiry" placeholder="06/2026"/></div></div>
            </div>
          </div>
          <div id="obClientFields" style="display:none">
            <div class="fg"><label class="flbl">গ্রাহক নির্বাচন <span class="r-star">*</span></label>
              <div id="sdObClient"></div>
            </div>
          </div>
          <div id="obSupFields" style="display:none">
            <div class="fg"><label class="flbl">সরবরাহকারী নির্বাচন <span class="r-star">*</span></label>
              <div id="sdObSup"></div>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-6"><div class="fg"><label class="flbl">পরিমাণ (৳) <span class="r-star">*</span></label><input type="number" class="fc" id="obAmount" min="0" placeholder="০.০০"/></div></div>
            <div class="col-6"><div class="fg"><label class="flbl">তারিখ</label><input type="date" class="fc" id="obDate"/></div></div>
          </div>
          <div class="fg"><label class="flbl">বিবরণ</label><input type="text" class="fc" id="obDesc" placeholder="বিবরণ লিখুন"/></div>
          <button class="btn-p w-100 mt-1" onclick="submitOpening()"><i class="fa-solid fa-floppy-disk"></i> Opening এন্ট্রি সংরক্ষণ</button>
        </div>
      </div>
    </div>
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-list-ul"></i> Opening Balance তালিকা</h5>
          <span class="bp bl" id="obCount">লোড...</span>
        </div>
        <div class="card-body pb-0" id="obSummary"></div>
        <div class="tw" style="max-height:380px">
          <table class="tbl">
            <thead><tr><th>তারিখ</th><th>ক্যাটাগরি</th><th>বিবরণ</th><th>পরিমাণ</th><th>Action</th></tr></thead>
            <tbody id="obTbody"><tr><td colspan="5"><div class="empty"><i class="fa-solid fa-clock-rotate-left"></i><p>কোনো এন্ট্রি নেই</p></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /opening -->


<!-- ════ CUSTOMERS ════ -->
<div id="tab-customers" class="tab">
  <div class="pg-hdr"><h2><i class="fa-solid fa-users me-2" style="color:var(--accent)"></i>গ্রাহক ব্যবস্থাপনা</h2></div>
  <div class="row g-3">
    <div class="col-lg-4">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-user-plus"></i> নতুন গ্রাহক</h5></div>
        <div class="card-body">
          <div class="ia s" id="custOk"><i class="fa-solid fa-circle-check"></i> গ্রাহক যোগ হয়েছে!</div>
          <div class="ia d" id="custErr"><i class="fa-solid fa-circle-xmark"></i><span id="custErrMsg"></span></div>
          <div class="fg"><label class="flbl">গ্রাহক ID <span class="r-star">*</span></label><input type="text" class="fc" id="cId" placeholder="C001"/></div>
          <div class="fg"><label class="flbl">নাম <span class="r-star">*</span></label><input type="text" class="fc" id="cName" placeholder="পূর্ণ নাম"/></div>
          <div class="fg"><label class="flbl">ফোন <span class="r-star">*</span></label><input type="tel" class="fc" id="cPhone" placeholder="01XXXXXXXXX"/></div>
          <div class="fg"><label class="flbl">ঠিকানা</label><input type="text" class="fc" id="cAddr" placeholder="গ্রাম, উপজেলা"/></div>
          <button class="btn-s w-100" onclick="submitCustomer()"><i class="fa-solid fa-user-check"></i> গ্রাহক নিবন্ধন করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-8">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-list-ul"></i> গ্রাহক তালিকা</h5>
          <span class="bp bl" id="custCount">লোড...</span>
        </div>
        <div class="tw" style="max-height:450px">
          <table class="tbl">
            <thead><tr><th>ID</th><th>নাম</th><th>ফোন</th><th>বাকি (৳)</th><th>মোট পরিশোধ</th><th>Action</th></tr></thead>
            <tbody id="custTbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /customers -->


<!-- ════ SUPPLIERS ════ -->
<div id="tab-suppliers" class="tab">
  <div class="pg-hdr"><h2><i class="fa-solid fa-building me-2" style="color:var(--accent)"></i>সরবরাহকারী ব্যবস্থাপনা</h2></div>
  <div class="row g-3">
    <div class="col-lg-4">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-plus-circle"></i> নতুন সরবরাহকারী</h5></div>
        <div class="card-body">
          <div class="ia s" id="supOk"><i class="fa-solid fa-circle-check"></i> সরবরাহকারী যোগ হয়েছে!</div>
          <div class="ia d" id="supErr"><i class="fa-solid fa-circle-xmark"></i><span id="supErrMsg"></span></div>
          <div class="fg"><label class="flbl">সরবরাহকারী ID <span class="r-star">*</span></label><input type="text" class="fc" id="sId" placeholder="S001"/></div>
          <div class="fg"><label class="flbl">নাম <span class="r-star">*</span></label><input type="text" class="fc" id="sName" placeholder="প্রতিষ্ঠানের নাম"/></div>
          <div class="fg"><label class="flbl">ফোন <span class="r-star">*</span></label><input type="tel" class="fc" id="sPhone" placeholder="01XXXXXXXXX"/></div>
          <div class="fg"><label class="flbl">ঠিকানা</label><input type="text" class="fc" id="sAddr" placeholder="ঠিকানা"/></div>
          <button class="btn-d w-100" onclick="submitSupplier()"><i class="fa-solid fa-building"></i> সরবরাহকারী যোগ করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-8">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-list-ul"></i> সরবরাহকারী তালিকা</h5>
          <span class="bp bl" id="supCount">লোড...</span>
        </div>
        <div class="tw" style="max-height:450px">
          <table class="tbl">
            <thead><tr><th>ID</th><th>নাম</th><th>ফোন</th><th>মোট বাকি (৳)</th><th>মোট পরিশোধ</th><th>Action</th></tr></thead>
            <tbody id="supTbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div><!-- /suppliers -->


<!-- ════ ACCOUNTS ════ -->
<div id="tab-accounts" class="tab">
  <div class="pg-hdr"><h2><i class="fa-solid fa-book-open me-2" style="color:var(--accent)"></i>অ্যাকাউন্টস ও বাকি</h2></div>
  <div class="row g-3">
    <div class="col-lg-7">
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-users"></i> বাকি গ্রাহক তালিকা</h5>
          <span class="bp d" id="dueCount">লোড...</span>
        </div>
        <div class="card-body" id="dueLedger"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো বকেয়া নেই</p></div></div>
      </div>
    </div>
    <div class="col-lg-5">
      <!-- Receive Payment -->
      <div class="card mb-3">
        <div class="card-hdr"><h5><i class="fa-solid fa-money-bill-wave"></i> বাকি পরিশোধ গ্রহণ</h5></div>
        <div class="card-body">
          <div class="ia s" id="payOk"><i class="fa-solid fa-circle-check"></i> পরিশোধ গৃহীত!</div>
          <div class="ia d" id="payErr"><i class="fa-solid fa-circle-xmark"></i><span id="payErrMsg"></span></div>
          <div class="fg">
            <label class="flbl">গ্রাহক <span class="r-star">*</span></label>
            <div id="sdPayCust"></div>
          </div>
          <div class="fg"><label class="flbl">বর্তমান বাকি</label><input type="text" class="fc dcalc" id="payCurrDue" readonly/></div>
          <div class="fg"><label class="flbl">পরিশোধ পরিমাণ (৳) <span class="r-star">*</span></label><input type="number" class="fc" id="payAmt" min="0.01" step="0.01" placeholder="০.০০"/></div>
          <div class="fg"><label class="flbl">তারিখ</label><input type="date" class="fc" id="payDate"/></div>
          <button class="btn-s w-100" onclick="submitPayment()"><i class="fa-solid fa-circle-check"></i> পরিশোধ গ্রহণ করুন</button>
        </div>
      </div>

      <!-- ═══ DAILY INCOME/EXPENSE LOG ═══ -->
      <div class="card">
        <div class="card-hdr">
          <h5><i class="fa-solid fa-book-open-reader"></i> দৈনিক আয়-ব্যয় লগ</h5>
          <span class="bp bl" id="ledBadge">আজ</span>
        </div>
        <div class="card-body" style="padding-bottom:10px">
          <!-- Tabs: income / expense / all -->
          <div class="led-type-tab">
            <button id="ledTabAll" class="active" onclick="setLedTab('all')">সব</button>
            <button id="ledTabIn" onclick="setLedTab('in')"><i class="fa-solid fa-arrow-down text-s me-1"></i>আয়</button>
            <button id="ledTabOut" onclick="setLedTab('out')"><i class="fa-solid fa-arrow-up text-d me-1"></i>ব্যয়</button>
          </div>
          <!-- Quick totals -->
          <div class="row g-2 mb-2">
            <div class="col-4 text-center">
              <div style="font-size:.68rem;color:var(--muted);font-weight:600;text-transform:uppercase">মোট আয়</div>
              <div class="led-type-in mono" id="ledTotalIn">৳০</div>
            </div>
            <div class="col-4 text-center">
              <div style="font-size:.68rem;color:var(--muted);font-weight:600;text-transform:uppercase">মোট ব্যয়</div>
              <div class="led-type-out mono" id="ledTotalOut">৳০</div>
            </div>
            <div class="col-4 text-center">
              <div style="font-size:.68rem;color:var(--muted);font-weight:600;text-transform:uppercase">নিট</div>
              <div class="mono fw7" id="ledNet" style="color:var(--accent)">৳০</div>
            </div>
          </div>

          <!-- Add Expense -->
          <details style="margin-bottom:10px">
            <summary style="font-size:.8rem;font-weight:600;color:var(--accent);cursor:pointer;padding:6px 0">
              <i class="fa-solid fa-plus-circle me-1"></i> নতুন খরচ যোগ করুন
            </summary>
            <div style="padding-top:10px">
              <div class="ia s" id="expOk"><i class="fa-solid fa-circle-check"></i> খরচ রেকর্ড হয়েছে!</div>
              <div class="fg"><label class="flbl">বিবরণ <span class="r-star">*</span></label><input type="text" class="fc" id="expDesc" placeholder="যেমন: বিদ্যুৎ বিল"/></div>
              <div class="row g-2">
                <div class="col-6"><div class="fg"><label class="flbl">পরিমাণ (৳) <span class="r-star">*</span></label><input type="number" class="fc" id="expAmt" min="0.01" step="0.01" placeholder="০.০০"/></div></div>
                <div class="col-6"><div class="fg"><label class="flbl">তারিখ</label><input type="date" class="fc" id="expDate"/></div></div>
              </div>
              <div class="fg"><label class="flbl">ক্যাটাগরি</label>
                <select class="fs" id="expCat"><option>ইউটিলিটি</option><option>বেতন</option><option>ভাড়া</option><option>পরিবহন</option><option>রক্ষণাবেক্ষণ</option><option>অন্যান্য</option></select>
              </div>
              <button class="btn-d w-100 btn-sm" onclick="submitExpense()"><i class="fa-solid fa-plus-circle"></i> খরচ যোগ করুন</button>
            </div>
          </details>

          <!-- Log Table -->
          <div class="tw" style="max-height:240px">
            <table class="tbl">
              <thead><tr><th>ধরন</th><th>বিবরণ</th><th>ক্যাটাগরি</th><th>৳</th><th></th></tr></thead>
              <tbody id="ledTbody"><tr><td colspan="5"><div class="empty" style="padding:12px"><i class="fa-solid fa-book-open"></i><p>কোনো এন্ট্রি নেই</p></div></td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div><!-- /accounts -->


<!-- ════ SETTINGS ════ -->
<div id="tab-settings" class="tab">
  <div class="pg-hdr"><h2><i class="fa-solid fa-gear me-2" style="color:var(--accent)"></i>সেটিংস</h2></div>
  <div class="row g-3">
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-store"></i> ফার্মেসির তথ্য</h5></div>
        <div class="card-body">
          <div class="ia s" id="cfgOk"><i class="fa-solid fa-circle-check"></i> সংরক্ষিত হয়েছে!</div>
          <div class="fg"><label class="flbl">ফার্মেসির নাম <span class="r-star">*</span></label><input type="text" class="fc" id="cfgName"/></div>
          <div class="fg"><label class="flbl">মালিকের নাম</label><input type="text" class="fc" id="cfgOwner"/></div>
          <div class="fg"><label class="flbl">ফোন নম্বর</label><input type="tel" class="fc" id="cfgPhone"/></div>
          <div class="fg"><label class="flbl">ঠিকানা</label><input type="text" class="fc" id="cfgAddr"/></div>
          <div class="row g-2">
            <div class="col-6"><div class="fg"><label class="flbl">স্বল্প স্টক সীমা</label><input type="number" class="fc" id="cfgLow" min="1" value="10"/></div></div>
          </div>
          <button class="btn-p w-100 mt-1" onclick="saveSettings()"><i class="fa-solid fa-floppy-disk"></i> সংরক্ষণ করুন</button>
        </div>
      </div>
    </div>
    <div class="col-lg-6">
      <div class="card">
        <div class="card-hdr"><h5><i class="fa-solid fa-database"></i> ডেটাবেস তথ্য</h5></div>
        <div class="card-body">
          <div class="fg"><label class="flbl">Spreadsheet লিংক</label>
            <a id="cfgDbUrl" href="#" target="_blank" class="db-link-btn w-100" style="justify-content:center">
              <i class="fa-solid fa-table-cells"></i> Spreadsheet খুলুন
            </a>
          </div>
          <div class="fg mt-2"><label class="flbl">Spreadsheet ID</label><input type="text" class="fc mono" id="cfgDbId" readonly/></div>
          <button class="btn-o w-100 mt-2" onclick="showSetupModal()"><i class="fa-solid fa-plug"></i> অন্য DB সংযোগ করুন</button>
          <div class="divider"></div>
          <button class="btn-o w-100" onclick="runSetup()"><i class="fa-solid fa-wrench"></i> শিট মেরামত (Self-Heal)</button>
        </div>
      </div>
    </div>
  </div>
</div><!-- /settings -->

</main>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
'use strict';
// ════════════════════════════════════════════════════════════
// GLOBAL STATE
// ════════════════════════════════════════════════════════════
const G = {
  medicines:[], customers:[], suppliers:[], inventory:[],
  sales:[], purchases:[], expenses:[], dbUrl:'', dbId:'',
  pharmaName:'ফার্মেসি', posItems:[], purItems:[],
  editTarget:null, invAll:[], ledTab:'all',
};

// ════════════════════════════════════════════════════════════
// ═══ SEARCHABLE DROPDOWN ENGINE ═══
// ════════════════════════════════════════════════════════════
const SD = {}; // registry: id → { value, onChange }

/**
 * createSD(containerId, options, onChange, placeholder)
 * options: [{value, label, sub, badge, badgeClass}]
 */
function createSD(containerId, options, onChange, placeholder='— খুঁজুন বা নির্বাচন করুন —') {
  const container = el(containerId);
  if (!container) return;
  const id = containerId;
  SD[id] = { value: '', onChange };

  container.innerHTML = `
    <div class="sd-wrap" id="sdw_${id}">
      <div id="sdSel_${id}" style="display:none"></div>
      <div class="sd-input-row" id="sdRow_${id}">
        <input type="text" class="sd-search" id="sdIn_${id}" placeholder="${esc(placeholder)}" autocomplete="off"/>
        <div class="sd-chevron" id="sdChev_${id}"><i class="fa-solid fa-chevron-down"></i></div>
      </div>
      <div class="sd-dropdown" id="sdDrop_${id}"></div>
    </div>`;

  const inp   = el('sdIn_'+id);
  const drop  = el('sdDrop_'+id);
  const row   = el('sdRow_'+id);
  const selEl = el('sdSel_'+id);
  const chev  = el('sdChev_'+id);

  function renderOpts(q='') {
    const filtered = q ? options.filter(o =>
      (o.label+' '+(o.sub||'')).toLowerCase().includes(q.toLowerCase())
    ) : options;
    if (!filtered.length) {
      drop.innerHTML = `<div class="sd-empty"><i class="fa-solid fa-magnifying-glass me-1"></i>পাওয়া যায়নি</div>`;
    } else {
      drop.innerHTML = filtered.map(o => `
        <div class="sd-opt" data-val="${esc(o.value)}" onclick="sdSelect('${id}','${esc(o.value)}','${esc(o.label)}')">
          <div>
            <div class="sd-label">${esc(o.label)}</div>
            ${o.sub ? `<div class="sd-sub">${esc(o.sub)}</div>` : ''}
          </div>
          ${o.badge ? `<span class="bp ${o.badgeClass||'bl'} sd-badge">${esc(o.badge)}</span>` : ''}
        </div>`).join('');
    }
    drop.classList.add('open');
  }

  inp.addEventListener('input', () => renderOpts(inp.value));
  inp.addEventListener('focus', () => { if(!SD[id].value) renderOpts(inp.value); });
  chev.addEventListener('click', () => {
    if (drop.classList.contains('open')) { drop.classList.remove('open'); }
    else { renderOpts(inp.value); }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!el('sdw_'+id)?.contains(e.target)) drop.classList.remove('open');
  }, true);

  // Store update ref
  SD[id]._update = (newOpts) => { options.length=0; newOpts.forEach(o=>options.push(o)); };
  SD[id]._reset  = () => sdClear(id);
}

function sdSelect(id, value, label) {
  SD[id].value = value;
  const drop  = el('sdDrop_'+id);
  const row   = el('sdRow_'+id);
  const selEl = el('sdSel_'+id);
  if (drop) drop.classList.remove('open');
  if (row)   row.style.display = 'none';
  if (selEl) {
    selEl.style.display = '';
    selEl.innerHTML = `<div class="sd-selected">
      <span><i class="fa-solid fa-check-circle me-2" style="color:var(--success)"></i>${esc(label)}</span>
      <span class="sd-clear" onclick="sdClear('${id}')"><i class="fa-solid fa-xmark"></i></span>
    </div>`;
  }
  if (SD[id].onChange) SD[id].onChange(value);
}

function sdClear(id) {
  SD[id].value = '';
  const row   = el('sdRow_'+id);
  const selEl = el('sdSel_'+id);
  const inp   = el('sdIn_'+id);
  const drop  = el('sdDrop_'+id);
  if (row)   row.style.display = '';
  if (selEl) selEl.style.display = 'none';
  if (inp)   inp.value = '';
  if (drop)  drop.classList.remove('open');
  if (SD[id].onChange) SD[id].onChange('');
}

function sdGetValue(id) { return SD[id]?.value || ''; }

function sdSetOptions(id, newOpts) {
  if (SD[id]?._update) SD[id]._update(newOpts);
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setTodayDates();
  updateDashDate();
  loMsg('সিস্টেম লোড হচ্ছে...');

  // Init empty SDs
  initAllSDs();

  if (isGAS()) {
    google.script.run
      .withSuccessHandler(r => { if(r&&r.success) onConnected(r); else showSetupModal(); })
      .withFailureHandler(() => showSetupModal())
      .getConfig();
  } else {
    setTimeout(() => onConnected({ success:true, pharmacyName:'ডেমো ফার্মেসি', dbUrl:'#', dbId:'demo' }), 1200);
  }
});

function initAllSDs() {
  // POS customer
  createSD('sdPosCust', buildCustOpts([], true), (v) => {}, '— গ্রাহক খুঁজুন —');
  // Purchase supplier
  createSD('sdPurSup', buildSupOpts([]), (v) => {}, '— সরবরাহকারী খুঁজুন —');
  // Accounts payment
  createSD('sdPayCust', buildCustOpts([], false), onPayCustSelect, '— গ্রাহক খুঁজুন —');
  // Opening balance
  createSD('sdObMed', buildMedOpts([]), onObMedSelectSD, '— ওষুধ খুঁজুন —');
  createSD('sdObClient', buildCustOpts([], false), () => {}, '— গ্রাহক খুঁজুন —');
  createSD('sdObSup', buildSupOpts([]), () => {}, '— সরবরাহকারী খুঁজুন —');
}

function buildCustOpts(custs, includeWalkIn) {
  const opts = [];
  if (includeWalkIn) opts.push({ value:'WALK_IN', label:'নগদ গ্রাহক (Walk-In)', sub:'কোনো নিবন্ধন নেই' });
  custs.forEach(c => opts.push({
    value: c.id, label: c.name,
    sub: (c.phone||'') + (c.due>0 ? ` • বাকি: ৳${fmt(c.due)}` : ''),
    badge: c.due>0 ? `৳${fmt(c.due)}` : null, badgeClass:'d'
  }));
  return opts;
}

function buildSupOpts(sups) {
  return sups.map(s => ({
    value: s.id, label: s.name,
    sub: s.phone || '',
    badge: s.totalPayable>0 ? `বাকি ৳${fmt(s.totalPayable)}` : null, badgeClass:'w'
  }));
}

function buildMedOpts(invAll) {
  return invAll.map(m => ({
    value: m.medId, label: m.brand,
    sub: `${m.doseForm||''} ${m.strength||''} • স্টক: ${m.totalStock}`,
    badge: m.status==='out'?'শূন্য':m.status==='low'?'স্বল্প':null,
    badgeClass: m.status==='out'?'d':'w'
  }));
}

function rebuildSDs() {
  // Customer SDs
  const custOpts = buildCustOpts(G.customers, true);
  const custOptsNW = buildCustOpts(G.customers, false);
  const supOpts  = buildSupOpts(G.suppliers);
  const medOpts  = buildMedOpts(G.invAll);

  sdSetOptions('sdPosCust', custOpts);
  sdSetOptions('sdPurSup',  supOpts);
  sdSetOptions('sdPayCust', custOptsNW);
  sdSetOptions('sdObMed',   medOpts);
  sdSetOptions('sdObClient',custOptsNW);
  sdSetOptions('sdObSup',   supOpts);
}

function onConnected(r) {
  G.pharmaName = r.pharmacyName||'ফার্মেসি';
  G.dbUrl = r.dbUrl||'#'; G.dbId = r.dbId||'';
  setText('pharmaName', G.pharmaName);
  updateDbLink(); loadCfgForm(r);
  loMsg('ডেটা লোড হচ্ছে...');
  loadAllData();
}

function loadAllData() {
  if (isGAS()) {
    google.script.run
      .withSuccessHandler(r => { if(r&&r.success) applyData(r); else { hideOverlay(); toast(r?.message||'ডেটা লোড ব্যর্থ!','d'); }})
      .withFailureHandler(e => { hideOverlay(); toast('Error: '+e.message,'d'); })
      .getCompleteData();
  } else {
    setTimeout(() => applyData(getMockData()), 700);
  }
}

function applyData(r) {
  G.medicines=r.medicines||[]; G.customers=r.customers||[];
  G.suppliers=r.suppliers||[]; G.inventory=r.inventory||[];
  G.sales=r.sales||[]; G.purchases=r.purchases||[];
  G.expenses=r.expenses||[]; G.invAll=r.inventory||[];
  if (r.dbUrl) { G.dbUrl=r.dbUrl; updateDbLink(); }
  if (r.dbId)  G.dbId=r.dbId;
  rebuildSDs();
  renderAll();
  hideOverlay();
}

function renderAll() {
  renderDashboard();
  renderMedicineTable();
  renderInventoryTable();
  renderPurchaseLog();
  renderCustomers();
  renderSuppliers();
  renderDueLedger();
  renderLedger();
  renderTodaySales();
  renderPurItemMedDrops();
}

function refreshAll() {
  showSpinner('রিফ্রেশ হচ্ছে...');
  if (isGAS()) {
    google.script.run
      .withSuccessHandler(r => { hideSpinner(); if(r&&r.success){applyData(r);toast('রিফ্রেশ সফল!','s');} else toast(r?.message||'ব্যর্থ!','d'); })
      .withFailureHandler(e => { hideSpinner(); toast(e.message,'d'); })
      .getCompleteData();
  } else {
    setTimeout(() => { hideSpinner(); applyData(getMockData()); toast('রিফ্রেশ হয়েছে!','s'); }, 600);
  }
}

// ════════════════════════════════════════════════════════════
// DB CONNECT
// ════════════════════════════════════════════════════════════
function showSetupModal() { show('setupModal'); hideOverlay(); }
function closeSetupModal() { hide('setupModal'); }

function doConnect() {
  const id = v('ssIdInput').trim();
  hideIA('setupError'); showSpinner(id?'সংযোগ হচ্ছে...':'ডেটাবেস তৈরি হচ্ছে...'); closeSetupModal();
  if (isGAS()) {
    google.script.run
      .withSuccessHandler(r => {
        hideSpinner();
        if (r&&r.success) { google.script.run.storeDbId(r.dbId); onConnected(r); toast('✅ সংযুক্ত!','s'); }
        else { showSetupModal(); showIA('setupError', r?.error||'সংযোগ ব্যর্থ।'); }
      })
      .withFailureHandler(e => { hideSpinner(); showSetupModal(); showIA('setupError',e.message); })
      .connectDatabase(id);
  } else {
    setTimeout(() => { hideSpinner(); onConnected({success:true,pharmacyName:'ডেমো',dbUrl:'#',dbId:id||'demo'}); }, 800);
  }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD (enriched)
// ════════════════════════════════════════════════════════════
function updateDashDate() {
  const d = new Date();
  const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  setText('dashDate', `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`);
}

function renderDashboard() {
  const today = todayStr();
  const todaySales  = G.sales.filter(s => s.date===today);
  const todayTotal  = todaySales.reduce((a,b)=>a+(b.totalBill||0),0);
  const todayDue    = todaySales.reduce((a,b)=>a+(b.due||0),0);
  const uniqueInv   = new Set(todaySales.map(s=>s.invoiceNo)).size;
  const totalCustDue= G.customers.reduce((a,b)=>a+(b.due||0),0);
  const dueCusts    = G.customers.filter(c=>c.due>0);
  const todayExp    = G.expenses.filter(e=>e.date===today);
  const todayExpTot = todayExp.reduce((a,b)=>a+(b.amount||0),0);
  const stockCost   = G.invAll.reduce((a,b)=>a+(b.costValue||0),0);
  const stockMRP    = G.invAll.reduce((a,b)=>a+(b.mrpValue||0),0);
  const lowStock    = G.invAll.filter(m=>m.status!=='ok');
  const outStock    = G.invAll.filter(m=>m.status==='out');
  const todayPurchases = G.purchases.filter(p=>p.date===today);
  const todayPurTotal  = todayPurchases.reduce((a,b)=>a+(b.totalCost||0),0);
  const todayNetProfit = todayTotal - todayExpTot - todayPurTotal;

  // ── KPI GRID ──
  const kpis = [
    { label:'আজকের বিক্রয়', val:'৳'+fmtK(todayTotal), sub:uniqueInv+' টি ইনভয়েস', ico:'fa-sack-dollar', cls:'blue', color:'var(--accent)' },
    { label:'আজকের নগদ আয়', val:'৳'+fmtK(todayTotal-todayDue), sub:'বাকি বাদে', ico:'fa-money-bill-wave', cls:'green', color:'var(--success)' },
    { label:'মোট বকেয়া', val:'৳'+fmtK(totalCustDue), sub:dueCusts.length+' জন গ্রাহক', ico:'fa-file-invoice-dollar', cls:'red', color:'var(--danger)' },
    { label:'আজকের খরচ', val:'৳'+fmtK(todayExpTot), sub:todayExp.length+' টি এন্ট্রি', ico:'fa-receipt', cls:'orange', color:'var(--warn)' },
    { label:'স্টক মূল্য (Cost)', val:'৳'+fmtK(stockCost), sub:'MRP: ৳'+fmtK(stockMRP), ico:'fa-boxes-stacked', cls:'teal', color:'#00695C' },
    { label:'আজকের নিট লাভ', val:(todayNetProfit>=0?'৳':'−৳')+fmtK(Math.abs(todayNetProfit)), sub:'বিক্রয় − ক্রয় − খরচ', ico:'fa-chart-line', cls:'purple', color:'#6F42C1' },
  ];
  el('dashKpiGrid').innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.cls}">
      <div class="kpi-top">
        <div class="kpi-ico" style="background:${k.color}22;color:${k.color}"><i class="fa-solid ${k.ico}"></i></div>
      </div>
      <div class="kpi-val" style="color:${k.color}">${esc(k.val)}</div>
      <div class="kpi-lbl">${esc(k.label)}</div>
      <div class="kpi-trend text-m">${esc(k.sub)}</div>
    </div>`).join('');

  // ── P&L Summary ──
  const plEl = el('dashPLSummary');
  const netColor = todayNetProfit>=0 ? 'var(--success)' : 'var(--danger)';
  const maxVal = Math.max(todayTotal, todayExpTot+todayPurTotal, 1);
  plEl.innerHTML = `
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--success);font-weight:600">আয়</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${Math.min(100,todayTotal/maxVal*100).toFixed(1)}%;background:var(--success)"></div></div>
      <div class="summary-bar-val text-s">৳${fmtK(todayTotal)}</div>
    </div>
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--warn);font-weight:600">ক্রয়</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${Math.min(100,todayPurTotal/maxVal*100).toFixed(1)}%;background:var(--warn)"></div></div>
      <div class="summary-bar-val text-w">৳${fmtK(todayPurTotal)}</div>
    </div>
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--danger);font-weight:600">খরচ</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${Math.min(100,todayExpTot/maxVal*100).toFixed(1)}%;background:var(--danger)"></div></div>
      <div class="summary-bar-val text-d">৳${fmtK(todayExpTot)}</div>
    </div>
    <div class="divider" style="margin:12px 0"></div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:.8rem;font-weight:600;color:var(--muted)">নিট মুনাফা</span>
      <span style="font-size:1.1rem;font-weight:800;font-family:var(--mono);color:${netColor}">${todayNetProfit>=0?'':'−'}৳${fmtK(Math.abs(todayNetProfit))}</span>
    </div>`;

  // ── Stock Summary ──
  const stockEl = el('dashStockSummary');
  const total   = G.invAll.length || 1;
  const okCount = G.invAll.filter(m=>m.status==='ok').length;
  stockEl.innerHTML = `
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--success);font-weight:600">স্বাভাবিক</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${(okCount/total*100).toFixed(1)}%;background:var(--success)"></div></div>
      <div class="summary-bar-val text-s">${okCount} টি</div>
    </div>
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--warn);font-weight:600">স্বল্প স্টক</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${((lowStock.length-outStock.length)/total*100).toFixed(1)}%;background:var(--warn)"></div></div>
      <div class="summary-bar-val text-w">${lowStock.length-outStock.length} টি</div>
    </div>
    <div class="summary-bar-wrap">
      <div class="summary-bar-label" style="color:var(--danger);font-weight:600">স্টকশূন্য</div>
      <div class="summary-bar-outer"><div class="summary-bar-inner" style="width:${(outStock.length/total*100).toFixed(1)}%;background:var(--danger)"></div></div>
      <div class="summary-bar-val text-d">${outStock.length} টি</div>
    </div>
    <div class="divider" style="margin:12px 0"></div>
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:.78rem;color:var(--muted)">Cost মূল্য</span>
      <span class="mono fw7 text-p">৳${fmtK(stockCost)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <span style="font-size:.78rem;color:var(--muted)">MRP মূল্য</span>
      <span class="mono fw7 text-s">৳${fmtK(stockMRP)}</span>
    </div>`;

  // ── Due Summary ──
  const dueEl = el('dashDueSummary');
  const supDue= G.suppliers.reduce((a,b)=>a+(b.totalPayable||0),0);
  dueEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.82rem;color:var(--muted)"><i class="fa-solid fa-users me-2" style="color:var(--danger)"></i>গ্রাহক বাকি</span>
      <span class="mono fw7 text-d">৳${fmtK(totalCustDue)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:.82rem;color:var(--muted)"><i class="fa-solid fa-building me-2" style="color:var(--warn)"></i>সরবরাহকারী বাকি</span>
      <span class="mono fw7 text-w">৳${fmtK(supDue)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
      <span style="font-size:.82rem;color:var(--muted)"><i class="fa-solid fa-arrow-right-arrow-left me-2" style="color:var(--accent)"></i>নিট বকেয়া পার্থক্য</span>
      <span class="mono fw7 text-p">৳${fmtK(Math.abs(totalCustDue-supDue))}</span>
    </div>
    <div class="divider" style="margin:8px 0"></div>
    <div style="font-size:.76rem;color:var(--muted)">বাকি গ্রাহক: <strong>${dueCusts.length} জন</strong> &bull; সর্বোচ্চ বাকি: <strong>${dueCusts.length?'৳'+fmt(Math.max(...dueCusts.map(c=>c.due))):'—'}</strong></div>`;

  // ── Expiry Alerts ──
  const today0 = new Date(); today0.setHours(0,0,0,0);
  const in90   = new Date(today0); in90.setDate(in90.getDate()+90);
  const expAlerts=[];
  G.invAll.forEach(m=>{
    if(!m.nearestExpiry) return;
    const ed=parseExpiryDate(m.nearestExpiry);
    if(ed&&ed<=in90) expAlerts.push({...m,expDate:ed,daysLeft:Math.ceil((ed-today0)/86400000)});
  });
  expAlerts.sort((a,b)=>a.daysLeft-b.daysLeft);
  setText('expiryCount',expAlerts.length+' টি');
  const eTbody=el('expiryTbody');
  eTbody.innerHTML=expAlerts.length?expAlerts.map(m=>{
    const exp=m.daysLeft<=0;
    const badge=exp?`<span class="bp d">মেয়াদোত্তীর্ণ</span>`:m.daysLeft<=30?`<span class="bp w">${m.daysLeft} দিন</span>`:`<span class="bp i">${m.daysLeft} দিন</span>`;
    return `<tr><td class="fw7">${esc(m.brand)} <small class="text-m">${esc(m.doseForm||'')} ${esc(m.strength||'')}</small></td><td class="mono">${m.totalStock}</td><td class="${exp?'text-d fw7':''}">${esc(m.nearestExpiry)}</td><td>${badge}</td></tr>`;
  }).join(''):`<tr><td colspan="4"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো সতর্কতা নেই</p></div></td></tr>`;

  // ── Low Stock ──
  setText('lowStockCount',lowStock.length+' টি');
  const lTbody=el('lowStockTbody');
  lTbody.innerHTML=lowStock.length?lowStock.map(m=>{
    const badge=m.status==='out'?`<span class="bp d"><i class="fa-solid fa-circle-xmark"></i> শূন্য</span>`:`<span class="bp w"><i class="fa-solid fa-triangle-exclamation"></i> স্বল্প</span>`;
    return `<tr><td class="fw7">${esc(m.brand)} <small class="text-m">${esc(m.doseForm||'')}</small></td><td class="mono ${m.status==='out'?'text-d':''} fw7">${m.totalStock}</td><td>${badge}</td></tr>`;
  }).join(''):`<tr><td colspan="3"><div class="empty"><i class="fa-solid fa-circle-check"></i><p>স্বাভাবিক</p></div></td></tr>`;

  // ── Due Customers (dashboard card) ──
  const dashDue=el('dashDueList');
  dashDue.innerHTML=dueCusts.length?dueCusts.sort((a,b)=>b.due-a.due).slice(0,8).map(c=>`
    <div class="due-row-item">
      <div class="di-info">
        <h6><i class="fa-solid fa-user me-1" style="color:var(--accent)"></i>${esc(c.name)}</h6>
        <p><i class="fa-solid fa-phone me-1"></i>${esc(c.phone||'—')} &bull; ${esc(c.id)}</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="di-due">৳${fmt(c.due)}</div>
        <button class="btn-s btn-sm" onclick="quickPay('${esc(c.id)}')"><i class="fa-solid fa-money-bill-wave"></i></button>
      </div>
    </div>`).join(''):`<div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো বকেয়া নেই</p></div>`;

  // ── Recent Sales ──
  const rSales=el('dashRecentSales');
  const todaySalesSorted=todaySales.slice().reverse().slice(0,10);
  rSales.innerHTML=todaySalesSorted.length?todaySalesSorted.map(s=>`
    <tr>
      <td class="mono" style="font-size:.72rem">${esc(s.invoiceNo)}</td>
      <td>${esc(s.customerName)}</td>
      <td class="mono fw7">৳${fmt(s.totalBill)}</td>
      <td>${s.due>0?`<span class="bp d">৳${fmt(s.due)}</span>`:`<span class="bp s">—</span>`}</td>
    </tr>`).join(''):`<tr><td colspan="4"><div class="empty" style="padding:14px"><i class="fa-solid fa-receipt"></i><p>আজ কোনো বিক্রয় নেই</p></div></td></tr>`;
}

// ════════════════════════════════════════════════════════════
// LEDGER (আয়-ব্যয়)
// ════════════════════════════════════════════════════════════
function setLedTab(tab) {
  G.ledTab=tab;
  ['all','in','out'].forEach(t=>el('ledTab'+t[0].toUpperCase()+t.slice(1))?.classList.remove('active'));
  // fix: capitalize correctly
  if(tab==='all') el('ledTabAll')?.classList.add('active');
  if(tab==='in')  el('ledTabIn')?.classList.add('active');
  if(tab==='out') el('ledTabOut')?.classList.add('active');
  renderLedger();
}

function renderLedger() {
  // Combine sales (income), expenses (expense), purchases (expense), payments received (income)
  const today = todayStr();
  const ledItems = [];

  // Sales → আয়
  const invMap={};
  G.sales.filter(s=>s.date===today).forEach(s=>{
    if(!invMap[s.invoiceNo]){ invMap[s.invoiceNo]=s; ledItems.push({type:'আয়',cat:'বিক্রয়',desc:s.invoiceNo+' — '+(s.customerName||''),amt:s.totalBill,id:s.invoiceNo,deletable:false}); }
  });

  // Expenses → ব্যয়
  G.expenses.filter(e=>e.date===today).forEach(e=>{
    ledItems.push({type:'ব্যয়',cat:e.category,desc:e.description,amt:e.amount,id:e.id,deletable:true});
  });

  // Purchases → ব্যয়
  G.purchases.filter(p=>p.date===today).forEach(p=>{
    ledItems.push({type:'ব্যয়',cat:'ওষুধ ক্রয়',desc:p.supplierName+' — '+(p.medicineName||''),amt:p.totalCost,id:p.purchaseId,deletable:false});
  });

  const totalIn  = ledItems.filter(x=>x.type==='আয়').reduce((a,b)=>a+b.amt,0);
  const totalOut = ledItems.filter(x=>x.type==='ব্যয়').reduce((a,b)=>a+b.amt,0);
  const netVal   = totalIn - totalOut;

  setText('ledTotalIn',  '৳'+fmtK(totalIn));
  setText('ledTotalOut', '৳'+fmtK(totalOut));
  const netEl=el('ledNet');
  netEl.textContent='৳'+fmtK(Math.abs(netVal));
  netEl.style.color=netVal>=0?'var(--success)':'var(--danger)';

  const filtered = G.ledTab==='all' ? ledItems
    : G.ledTab==='in' ? ledItems.filter(x=>x.type==='আয়')
    : ledItems.filter(x=>x.type==='ব্যয়');

  const tbody=el('ledTbody');
  if(!filtered.length){
    tbody.innerHTML=`<tr><td colspan="5"><div class="empty" style="padding:12px"><i class="fa-solid fa-book-open"></i><p>কোনো এন্ট্রি নেই</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML=filtered.map(x=>`<tr>
    <td><span class="bp ${x.type==='আয়'?'s':'d'}">${x.type==='আয়'?'↓ আয়':'↑ ব্যয়'}</span></td>
    <td style="font-size:.79rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.desc)}">${esc(x.desc)}</td>
    <td><span class="bp m">${esc(x.cat)}</span></td>
    <td class="mono fw7 ${x.type==='আয়'?'text-s':'text-d'}">৳${fmt(x.amt)}</td>
    <td>${x.deletable?`<button class="btn-icon del" onclick="confirmDeleteExp('${esc(x.id)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>`:'<span class="text-m" style="font-size:.7rem">—</span>'}</td>
  </tr>`).join('');
}

// ════════════════════════════════════════════════════════════
// POS
// ════════════════════════════════════════════════════════════
function clearPOS() {
  G.posItems=[];
  el('posItems').innerHTML='';
  sdClear('sdPosCust');
  el('posCash').value='';
  el('posTotalBill').value='';
  el('posDue').value='';
  hideIA('posErr');
  updateBillSummary(0,0,0,0);
  addPOSItem();
}

function addPOSItem() {
  const idx=G.posItems.length;
  G.posItems.push({medId:'',name:'',qty:1,price:0,discount:0});
  renderPOSItems();
}

function removePOSItem(idx) { G.posItems.splice(idx,1); renderPOSItems(); calcPOSTotal(); }

function renderPOSItems() {
  const container=el('posItems');
  container.innerHTML=G.posItems.map((item,i)=>{
    // বর্তমান লাইনে কোনো ওষুধ আগে থেকে সিলেক্ট করা থাকলে সেটির নাম ও স্টক বের করার জন্য
    const currentMed = G.invAll.find(m => m.medId === item.medId);
    const currentDisplayValue = currentMed ? `${currentMed.brand} ${currentMed.doseForm || ''} [স্টক: ${currentMed.totalStock}]` : '';

    return `
    <div class="pur-item">
      <div class="pur-item-del"><button class="btn-icon del" onclick="removePOSItem(${i})"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="row g-2">
        <div class="col-12 col-md-5">
          <label class="flbl">ওষুধ <span class="r-star">*</span></label>
          
          <input type="text" class="fc" id="posItemMed_${i}" list="medList_${i}" value="${esc(currentDisplayValue)}" onchange="onPOSMedSelect(${i})" placeholder="— ওষুধ সার্চ করুন —" autocomplete="off"/>
          
          <datalist id="medList_${i}">
            ${G.invAll.filter(m=>m.totalStock>0).map(m=>{
              const displayText = `${m.brand} ${m.doseForm || ''} [স্টক: ${m.totalStock}]`;
              return `<option value="${esc(displayText)}"></option>`;
            }).join('')}
          </datalist>
        </div>
        <div class="col-4 col-md-2"><label class="flbl">Qty</label><input type="number" class="fc" id="posItemQty_${i}" value="${item.qty}" min="1" oninput="onPOSItemChange(${i})"/></div>
        <div class="col-4 col-md-2"><label class="flbl">মূল্য (৳)</label><input type="number" class="fc" id="posItemPrice_${i}" value="${item.price}" min="0" step="0.01" oninput="onPOSItemChange(${i})"/></div>
        <div class="col-4 col-md-2"><label class="flbl">Disc (%)</label><input type="number" class="fc" id="posItemDisc_${i}" value="${item.discount}" min="0" max="100" oninput="onPOSItemChange(${i})"/></div>
      </div>
    </div>`;
  }).join('');
}

function onPOSMedSelect(i) {
  const inputVal = v('posItemMed_' + i);
  
  // ইউজার যে লেখাটি সিলেক্ট বা ইনপুট করেছে তার সাথে G.invAll এর ডেটা ম্যাচ করা হচ্ছে
  const med = G.invAll.find(m => {
    const displayText = `${m.brand} ${m.doseForm || ''} [স্টক: ${m.totalStock}]`;
    return displayText === inputVal;
  });

  if(med){ 
    G.posItems[i].medId=med.medId; 
    G.posItems[i].name=med.brand; 
    G.posItems[i].price=med.sellPrice||0; 
    el('posItemPrice_'+i).value=med.sellPrice||0; 
  } else {
    // যদি ইনপুট মুছে ফেলা হয় বা অমিল কিছু থাকে
    G.posItems[i].medId='';
    G.posItems[i].name='';
    G.posItems[i].price=0;
    el('posItemPrice_'+i).value=0;
  }
  calcPOSTotal();
}

function onPOSItemChange(i) {
  G.posItems[i].qty=parseFloat(v('posItemQty_'+i))||0;
  G.posItems[i].price=parseFloat(v('posItemPrice_'+i))||0;
  G.posItems[i].discount=parseFloat(v('posItemDisc_'+i))||0;
  calcPOSTotal();
}

function calcPOSTotal() {
  let medTotal=0,discTotal=0;
  G.posItems.forEach(item=>{ const lt=item.qty*item.price; const ld=lt*(item.discount/100); medTotal+=lt; discTotal+=ld; });
  const grandTotal=Math.max(0,round2(medTotal-discTotal));
  el('posTotalBill').value=grandTotal.toFixed(2);
  calcDue();
  updateBillSummary(medTotal,discTotal,grandTotal,parseFloat(v('posCash'))||0);
}

function calcDue() {
  const total=parseFloat(el('posTotalBill').value)||0;
  const cash=parseFloat(v('posCash'))||0;
  const due=Math.max(0,round2(total-cash));
  el('posDue').value=due.toFixed(2);
  setText('bCash','৳'+fmt(cash)); setText('bDue','৳'+fmt(due));
}

function updateBillSummary(med,disc,total,cash) {
  setText('bMed','৳'+fmt(med)); setText('bDisc','৳'+fmt(disc));
  setText('bTotal','৳'+fmt(total)); setText('bCash','৳'+fmt(cash));
  setText('bDue','৳'+fmt(Math.max(0,total-cash)));
}

function submitPOS() {
  hideIA('posErr');
  const custId=sdGetValue('sdPosCust');
  const cashPaid=parseFloat(v('posCash'))||0;
  const total=parseFloat(el('posTotalBill').value)||0;
  const due=parseFloat(el('posDue').value)||0;
  const date=v('posDate')||todayStr();
  const customer=G.customers.find(c=>c.id===custId);
  const custName=custId==='WALK_IN'?'নগদ গ্রাহক':(customer?.name||custId||'নগদ গ্রাহক');
  if(!custId){ showIA('posErr','গ্রাহক নির্বাচন করুন।'); el('posErrMsg').textContent='গ্রাহক নির্বাচন করুন।'; return; }
  const validItems=G.posItems.filter(i=>i.medId&&i.qty>0);
  if(!validItems.length){ showIA('posErr','কমপক্ষে একটি ওষুধ যোগ করুন।'); el('posErrMsg').textContent='কমপক্ষে একটি ওষুধ যোগ করুন।'; return; }
  for(const item of validItems){
    const inv=G.invAll.find(m=>m.medId===item.medId);
    if(inv&&item.qty>inv.totalStock){ showIA('posErr',`"${inv.brand}" স্টক অপর্যাপ্ত। বর্তমান: ${inv.totalStock}`); el('posErrMsg').textContent=`স্টক অপর্যাপ্ত`; return; }
  }
  const saleData={date,customerName:custName,customerId:custId||'WALK_IN',cashPaid,due,paymentType:due>0?'বাকি':'নগদ',
    medicines:validItems.map(i=>({medicineId:i.medId,name:i.name,qty:i.qty,price:i.price,discount:i.discount}))};
  const btn=el('posSubmitBtn'); btn.disabled=true;
  showSpinner('বিক্রয় প্রক্রিয়াকরণ...');
  if(isGAS()){
    google.script.run
      .withSuccessHandler(r=>{hideSpinner();btn.disabled=false;if(r&&r.success){toast('বিক্রয় সফল! '+r.invoiceNo,'s');clearPOS();refreshAll();}else{showIA('posErr',r?.message||'ব্যর্থ!');el('posErrMsg').textContent=r?.message||'';}})
      .withFailureHandler(e=>{hideSpinner();btn.disabled=false;toast(e.message,'d');})
      .saveSale(saleData);
  } else {
    setTimeout(()=>{hideSpinner();btn.disabled=false;toast('বিক্রয় সফল! (Demo)','s');clearPOS();},700);
  }
}

function renderTodaySales() {
  const today=todayStr();
  const sales=G.sales.filter(s=>s.date===today);
  const tbody=el('todaySalesTbody');
  if(!sales.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty" style="padding:14px"><i class="fa-solid fa-file-invoice"></i><p>কোনো বিক্রয় নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=sales.slice(0,50).map(s=>`<tr>
    <td class="mono" style="font-size:.72rem">${esc(s.invoiceNo)}</td>
    <td>${esc(s.customerName)}</td>
    <td style="font-size:.78rem">${esc(s.medicineName)}</td>
    <td class="mono fw7">৳${fmt(s.totalBill)}</td>
    <td>${s.due>0?`<span class="bp d">৳${fmt(s.due)}</span>`:`<span class="bp s">—</span>`}</td>
    <td><button class="btn-icon del" onclick="confirmDeleteSale('${esc(s.invoiceNo)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`).join('');
}

function confirmDeleteSale(invNo) {
  if(!confirm('"'+invNo+'" মুছবেন? স্টক ও বাকি ফেরত আসবে।'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()){google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteSale(invNo);}
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}
// ════════════════════════════════════════════════════════════
// MEDICINE
// ════════════════════════════════════════════════════════════
function submitMedicine() {
  hideIA('medErr');hideIA('medOk');
  const brand=v('mBrand').trim();
  if(!brand){showIA('medErr','ব্র্যান্ড নাম দিন।');el('medErrMsg').textContent='ব্র্যান্ড নাম দিন।';return;}
  const data={brand,generic:v('mGeneric'),doseForm:v('mDose'),strength:v('mStr'),manufacturer:v('mMfr'),category:v('mCat'),unit:v('mUnit'),reorderLevel:parseInt(v('mReorder'))||10};
  showSpinner('ওষুধ যোগ হচ্ছে...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('medOk');toast(r.message,'s');['mBrand','mGeneric','mStr','mMfr'].forEach(id=>el(id).value='');refreshAll();}else{showIA('medErr',r?.message||'ব্যর্থ!');el('medErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('medErr',e.message);el('medErrMsg').textContent=e.message;}).addMedicine(data);
  } else setTimeout(()=>{hideSpinner();showIA('medOk');toast('ওষুধ যোগ হয়েছে! (Demo)','s');},500);
}

function renderMedicineTable() {
  setText('medCount',G.medicines.length+' টি ওষুধ');
  const query=v('medSearch').toLowerCase();
  const data=query?G.medicines.filter(m=>(m.brand+' '+(m.generic||'')).toLowerCase().includes(query)):G.medicines;
  const tbody=el('medTbody');
  if(!data.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><i class="fa-solid fa-capsules"></i><p>কোনো ওষুধ নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=data.map(m=>`<tr>
    <td class="mono" style="font-size:.72rem">${esc(m.id)}</td>
    <td class="fw7">${esc(m.brand)}</td>
    <td class="text-m">${esc(m.generic||'—')}</td>
    <td><span class="bp m">${esc(m.doseForm||'—')}</span></td>
    <td>${esc(m.strength||'—')}</td>
    <td><span class="bp bl">${esc(m.category||'—')}</span></td>
    <td class="mono">${m.reorderLevel||10}</td>
    <td>
      <button class="btn-icon me-1" onclick="editMedicine('${esc(m.id)}')" title="এডিট"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon del" onclick="confirmDeleteMed('${esc(m.id)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>
    </td>
  </tr>`).join('');
}
function filterMedicines(){renderMedicineTable();}

function editMedicine(medId) {
  const m=G.medicines.find(x=>x.id===medId); if(!m)return;
  G.editTarget={type:'medicine',id:medId};
  setText('editModalTitle','ওষুধ এডিট: '+m.brand);
  el('editModalBody').innerHTML=`<div class="row g-2">
    <div class="col-6"><div class="fg"><label class="flbl">ব্র্যান্ড</label><input type="text" class="fc" id="em_brand" value="${esc(m.brand||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">জেনেরিক</label><input type="text" class="fc" id="em_generic" value="${esc(m.generic||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">ডোজ ফর্ম</label><input type="text" class="fc" id="em_dose" value="${esc(m.doseForm||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">শক্তি</label><input type="text" class="fc" id="em_str" value="${esc(m.strength||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">রি-অর্ডার</label><input type="number" class="fc" id="em_reorder" value="${m.reorderLevel||10}"/></div></div>
  </div>`;
  showModal('editModal');
}

function submitEdit() {
  if(!G.editTarget)return;
  const t=G.editTarget.type;
  let data={}, fn='';
  if(t==='medicine'){data={brand:v('em_brand'),generic:v('em_generic'),doseForm:v('em_dose'),strength:v('em_str'),reorderLevel:parseInt(v('em_reorder'))||10};fn='updateMedicine';}
  else if(t==='customer'){data={name:v('em_name'),phone:v('em_phone'),address:v('em_addr')};fn='updateCustomer';}
  else if(t==='batch'){data={sellPrice:parseFloat(v('em_sell'))||0,mrp:parseFloat(v('em_mrp'))||0,purchasePrice:parseFloat(v('em_cost'))||0,expiryDate:v('em_expiry'),currentStock:parseInt(v('em_stock'))||0};fn='updateBatch';}
  showSpinner('আপডেট হচ্ছে...');
  if(isGAS()){
    google.script.run[fn].call(google.script.run,G.editTarget.id,data)
    // GAS can't do dynamic method call above, so use explicit:
  }
  // Correct GAS call pattern:
  if(isGAS()){
    const onR=r=>{hideSpinner();if(r&&r.success){closeModal('editModal');toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');};
    const onF=e=>{hideSpinner();toast(e.message,'d');};
    if(t==='medicine') google.script.run.withSuccessHandler(onR).withFailureHandler(onF).updateMedicine(G.editTarget.id,data);
    else if(t==='customer') google.script.run.withSuccessHandler(onR).withFailureHandler(onF).updateCustomer(G.editTarget.id,data);
    else if(t==='batch') google.script.run.withSuccessHandler(onR).withFailureHandler(onF).updateBatch(G.editTarget.id,data);
  } else setTimeout(()=>{hideSpinner();closeModal('editModal');toast('আপডেট হয়েছে! (Demo)','s');},500);
}

function confirmDeleteMed(medId) {
  if(!confirm('ওষুধ মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteMedicine(medId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}

// ════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════
function renderInventoryTable() {
  const inv=G.invAll;
  setText('invTotal',inv.length);
  setText('invLow',inv.filter(m=>m.status==='low').length);
  setText('invOut',inv.filter(m=>m.status==='out').length);
  setText('invMRP','৳'+fmtK(inv.reduce((a,b)=>a+(b.mrpValue||0),0)));
  const query=v('invSearch').toLowerCase();
  const data=query?inv.filter(m=>(m.brand+' '+(m.doseForm||'')+(m.strength||'')).toLowerCase().includes(query)):inv;
  const tbody=el('invTbody');
  if(!data.length){tbody.innerHTML=`<tr><td colspan="9"><div class="empty"><i class="fa-solid fa-boxes-stacked"></i><p>কোনো স্টক নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=data.map(m=>{
    const badge=m.status==='out'?`<span class="bp d">শূন্য</span>`:m.status==='low'?`<span class="bp w">স্বল্প</span>`:`<span class="bp s">স্বাভাবিক</span>`;
    return `<tr>
      <td class="fw7">${esc(m.brand)}</td>
      <td><span class="bp m">${esc(m.doseForm||'—')}</span></td>
      <td>${esc(m.strength||'—')}</td>
      <td class="mono fw7 ${m.status==='out'?'text-d':m.status==='low'?'text-w':''}">${m.totalStock}</td>
      <td>${esc(m.nearestExpiry||'—')}</td>
      <td class="mono">৳${fmt(m.costValue||0)}</td>
      <td class="mono">৳${fmt(m.mrpValue||0)}</td>
      <td>${badge}</td>
      <td><button class="btn-icon" onclick="editBatch('${esc(m.medId)}')" title="এডিট"><i class="fa-solid fa-pen"></i></button></td>
    </tr>`;
  }).join('');
}
function filterInventory(){renderInventoryTable();}

function editBatch(medId) {
  const m=G.invAll.find(x=>x.medId===medId); if(!m)return;
  const fb=m.batches&&m.batches[0];
  G.editTarget={type:'batch',id:fb?.batchId||medId};
  setText('editModalTitle','স্টক/মূল্য এডিট: '+m.brand);
  el('editModalBody').innerHTML=`<div class="row g-2">
    <div class="col-6"><div class="fg"><label class="flbl">বিক্রয় মূল্য</label><input type="number" class="fc" id="em_sell" value="${fb?.sell||0}" min="0" step="0.01"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">MRP</label><input type="number" class="fc" id="em_mrp" value="${fb?.mrp||0}" min="0" step="0.01"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">ক্রয় মূল্য</label><input type="number" class="fc" id="em_cost" value="${fb?.cost||0}" min="0" step="0.01"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">মেয়াদ</label><input type="text" class="fc" id="em_expiry" value="${esc(fb?.expiry||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">বর্তমান স্টক</label><input type="number" class="fc" id="em_stock" value="${m.totalStock||0}" min="0"/></div></div>
  </div>
  <div class="ia w show mt-2"><i class="fa-solid fa-triangle-exclamation"></i> স্টক সংশোধন সাবধানে করুন।</div>`;
  showModal('editModal');
}

// ════════════════════════════════════════════════════════════
// PURCHASE
// ════════════════════════════════════════════════════════════
function onPurPayTypeChange(){el('purPaidBox').style.display=v('purPayType')==='বাকি'?'':'none';}

function addPurItem() {
  G.purItems.push({medId:'',brand:'',qty:1,purchasePrice:0,mrp:0,sellPrice:0,expiryDate:''});
  renderPurItems();
}
function removePurItem(i){G.purItems.splice(i,1);renderPurItems();}

function renderPurItems() {
  const container=el('purItems');
  if(!G.purItems.length){addPurItem();return;}
  container.innerHTML=G.purItems.map((item,i)=>{
    // বর্তমান লাইনে কোনো ওষুধ সিলেক্ট করা থাকলে সেটির প্রদর্শিত নাম বের করার জন্য
    const currentMed = G.medicines.find(m => m.id === item.medId);
    const currentDisplayValue = currentMed ? `${currentMed.brand} ${currentMed.doseForm || ''} ${currentMed.strength || ''}`.trim() : '';

    return `
    <div class="pur-item">
      <div class="pur-item-del"><button class="btn-icon del" onclick="removePurItem(${i})"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="row g-2">
        <div class="col-12 col-md-6"><label class="flbl">ওষুধ <span class="r-star">*</span></label>
          
          <input type="text" class="fc" id="purMed_${i}" list="purMedList_${i}" value="${esc(currentDisplayValue)}" onchange="onPurMedSelect(${i})" placeholder="— ওষুধ সার্চ করুন —" autocomplete="off"/>
          
          <datalist id="purMedList_${i}">
            ${G.medicines.map(m => {
              const displayText = `${m.brand} ${m.doseForm || ''} ${m.strength || ''}`.trim();
              return `<option value="${esc(displayText)}"></option>`;
            }).join('')}
          </datalist>
        </div>
        <div class="col-4 col-md-2"><label class="flbl">Qty</label><input type="number" class="fc" id="purQty_${i}" value="${item.qty}" min="1"/></div>
        <div class="col-4 col-md-2"><label class="flbl">ক্রয় মূল্য</label><input type="number" class="fc" id="purPrice_${i}" value="${item.purchasePrice}" min="0" step="0.01"/></div>
        <div class="col-4 col-md-2"><label class="flbl">MRP</label><input type="number" class="fc" id="purMRP_${i}" value="${item.mrp}" min="0" step="0.01"/></div>
        <div class="col-6 col-md-3"><label class="flbl">বিক্রয় মূল্য</label><input type="number" class="fc" id="purSell_${i}" value="${item.sellPrice}" min="0" step="0.01"/></div>
        <div class="col-6 col-md-3"><label class="flbl">মেয়াদ</label><input type="text" class="fc" id="purExp_${i}" value="${esc(item.expiryDate)}" placeholder="06/2026"/></div>
      </div>
    </div>`;
  }).join('');
}

function onPurMedSelect(i) {
  const inputVal = v('purMed_' + i);
  
  // ইনপুট টেক্সটের সাথে মিলিয়ে G.medicines থেকে সঠিক ওষুধটি খুঁজে বের করা
  const med = G.medicines.find(m => {
    const displayText = `${m.brand} ${m.doseForm || ''} ${m.strength || ''}`.trim();
    return displayText === inputVal;
  });

  if(med){
    G.purItems[i].medId=med.id;
    G.purItems[i].brand=med.brand;
    G.purItems[i].doseForm=med.doseForm||'';
    G.purItems[i].strength=med.strength||'';
  } else {
    // ইনপুট খালি করলে বা ভুল ডেটা দিলে মান রিসেট হবে
    G.purItems[i].medId='';
    G.purItems[i].brand='';
    G.purItems[i].doseForm='';
    G.purItems[i].strength='';
  }
}

function renderPurItemMedDrops() { renderPurItems(); }

function submitPurchase() {
  hideIA('purErr');hideIA('purOk');
  const supId=sdGetValue('sdPurSup');
  const date=v('purDate')||todayStr();
  const payType=v('purPayType');
  if(!supId){showIA('purErr','সরবরাহকারী নির্বাচন করুন।');el('purErrMsg').textContent='সরবরাহকারী নির্বাচন করুন।';return;}
  
  // ওষুধটি সঠিকভাবে সিলেক্ট হয়েছে কিনা তা ডাটাবেজের (G.medicines) সাপেক্ষে আইডি যাচাই করা
  const items=G.purItems.map((item,i)=>{
    const currentInputVal = v('purMed_' + i);
    const matchedMed = G.medicines.find(m => `${m.brand} ${m.doseForm || ''} ${m.strength || ''}`.trim() === currentInputVal);
    const finalMedId = matchedMed ? matchedMed.id : '';

    return {
      medicineId:finalMedId,
      brand:item.brand,
      doseForm:item.doseForm||'',
      strength:item.strength||'',
      qty:parseFloat(v('purQty_'+i))||0,
      purchasePrice:parseFloat(v('purPrice_'+i))||0,
      mrp:parseFloat(v('purMRP_'+i))||0,
      sellPrice:parseFloat(v('purSell_'+i))||0,
      expiryDate:v('purExp_'+i)
    };
  }).filter(i=>i.medicineId&&i.qty>0);

  if(!items.length){showIA('purErr','কমপক্ষে একটি ওষুধ দিন।');el('purErrMsg').textContent='ওষুধ যোগ করুন।';return;}
  const sup=G.suppliers.find(s=>s.id===supId);
  const purData={date,supplierName:sup?.name||supId,supplierId:supId,paymentType:payType,paid:parseFloat(v('purPaid'))||0,items};
  showSpinner('ক্রয় প্রক্রিয়াকরণ...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('purOk');setText('purOkMsg',r.message);toast(r.message,'s');G.purItems=[];renderPurItems();refreshAll();}else{showIA('purErr',r?.message||'ব্যর্থ!');el('purErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('purErr',e.message);el('purErrMsg').textContent=e.message;}).savePurchase(purData);
  } else setTimeout(()=>{hideSpinner();showIA('purOk');toast('ক্রয় রেকর্ড! (Demo)','s');},700);
}

function renderPurchaseLog() {
  setText('purCount',G.purchases.length+' টি');
  const tbody=el('purTbody');
  if(!G.purchases.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><i class="fa-solid fa-truck-field"></i><p>কোনো ক্রয় নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=G.purchases.slice(0,100).map(p=>`<tr>
    <td>${esc(p.date)}</td>
    <td class="mono" style="font-size:.72rem">${esc(p.invoiceNo||p.purchaseId)}</td>
    <td>${esc(p.supplierName)}</td>
    <td class="fw7">${esc(p.medicineName)}</td>
    <td class="mono">${p.qty}</td>
    <td class="mono">৳${fmt(p.purchasePrice)}</td>
    <td class="mono fw7">৳${fmt(p.totalCost)}</td>
    <td><button class="btn-icon del" onclick="confirmDeletePur('${esc(p.purchaseId)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`).join('');
}

function confirmDeletePur(purId) {
  if(!confirm('ক্রয় মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deletePurchase(purId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}
// ════════════════════════════════════════════════════════════
// OPENING BALANCE
// ════════════════════════════════════════════════════════════
function onObCatChange() {
  const cat=v('obCat');
  el('obStockFields').style.display=cat==='স্টক'?'':'none';
  el('obClientFields').style.display=cat==='গ্রাহক বাকি'?'':'none';
  el('obSupFields').style.display=cat==='সরবরাহকারী বাকি'?'':'none';
}

function onObMedSelectSD(medId) {
  const med=G.medicines.find(m=>m.id===medId);
  if(med){el('obMedStrip').style.display='flex';setText('obMedId',med.id);setText('obMedDose',med.doseForm||'—');setText('obMedStr',med.strength||'—');}
  else el('obMedStrip').style.display='none';
}

function submitOpening() {
  hideIA('obErr');hideIA('obOk');
  const cat=v('obCat');const amount=parseFloat(v('obAmount'))||0;const date=v('obDate')||todayStr();
  if(amount<=0){showIA('obErr','পরিমাণ দিন।');el('obErrMsg').textContent='পরিমাণ দিন।';return;}
  const entry={category:cat,amount,date,description:v('obDesc')};
  if(cat==='স্টক'){
    const medId=sdGetValue('sdObMed');
    if(!medId){showIA('obErr','ওষুধ নির্বাচন করুন।');el('obErrMsg').textContent='ওষুধ নির্বাচন করুন।';return;}
    const med=G.medicines.find(m=>m.id===medId);
    Object.assign(entry,{medicineId:medId,brand:med?.brand||'',doseForm:med?.doseForm||'',strength:med?.strength||'',qty:parseInt(v('obQty'))||0,costPrice:parseFloat(v('obCostPrice'))||0,mrp:parseFloat(v('obMRP'))||0,sellPrice:parseFloat(v('obSellPrice'))||0,expiryDate:v('obExpiry')});
    if(entry.qty<=0){showIA('obErr','পরিমাণ দিন।');el('obErrMsg').textContent='পরিমাণ দিন।';return;}
  } else if(cat==='গ্রাহক বাকি') {
    const cliId=sdGetValue('sdObClient');
    if(!cliId){showIA('obErr','গ্রাহক নির্বাচন করুন।');el('obErrMsg').textContent='গ্রাহক নির্বাচন করুন।';return;}
    entry.clientId=cliId;
  } else if(cat==='সরবরাহকারী বাকি') {
    const supId=sdGetValue('sdObSup');
    if(!supId){showIA('obErr','সরবরাহকারী নির্বাচন করুন।');el('obErrMsg').textContent='সরবরাহকারী নির্বাচন করুন।';return;}
    entry.supplierId=supId;
  }
  showSpinner('সংরক্ষণ হচ্ছে...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('obOk');setText('obOkMsg',r.message);toast(r.message,'s');refreshAll();renderOpeningTable();}else{showIA('obErr',r?.message||'ব্যর্থ!');el('obErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('obErr',e.message);el('obErrMsg').textContent=e.message;}).saveOpeningBalance([entry]);
  } else setTimeout(()=>{hideSpinner();showIA('obOk');setText('obOkMsg','এন্ট্রি সংরক্ষিত! (Demo)');},500);
}

function renderOpeningTable() {
  if(isGAS()) google.script.run.withSuccessHandler(r=>{if(r&&r.success)_renderObTable(r.entries||[],r.totals||{});}).withFailureHandler(()=>{}).getOpeningBalance();
  else _renderObTable([],{});
}

function _renderObTable(entries,totals) {
  setText('obCount',entries.length+' টি');
  const sumEl=el('obSummary');
  sumEl.innerHTML=Object.keys(totals).length>0?'<div class="row g-2 mb-2">'+Object.entries(totals).map(([k,v2])=>`<div class="col-6 col-md-4"><div class="stat bl" style="padding:10px 12px"><div class="slbl">${esc(k)}</div><div class="sval text-p" style="font-size:1.1rem">৳${fmt(v2)}</div></div></div>`).join('')+'</div>':'';
  const tbody=el('obTbody');
  if(!entries.length){tbody.innerHTML=`<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-clock-rotate-left"></i><p>কোনো এন্ট্রি নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=entries.map(e=>`<tr>
    <td>${esc(e.date)}</td>
    <td><span class="bp bl">${esc(e.category)}</span></td>
    <td>${esc(e.description||'—')}</td>
    <td class="mono fw7">৳${fmt(e.amount)}</td>
    <td><button class="btn-icon del" onclick="confirmDeleteOB('${esc(e.entryId)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`).join('');
}

function confirmDeleteOB(entryId) {
  if(!confirm('Opening Balance এন্ট্রি মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');renderOpeningTable();refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteOpeningEntry(entryId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}

// ════════════════════════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════════════════════════
function submitCustomer() {
  hideIA('custErr');hideIA('custOk');
  const id=v('cId').trim(),name=v('cName').trim(),phone=v('cPhone').trim();
  if(!id||!name||!phone){showIA('custErr','সব তথ্য দিন।');el('custErrMsg').textContent='সব তথ্য দিন।';return;}
  showSpinner('নিবন্ধন হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('custOk');toast(r.message,'s');['cId','cName','cPhone','cAddr'].forEach(i=>el(i).value='');refreshAll();}else{showIA('custErr',r?.message||'ব্যর্থ!');el('custErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('custErr',e.message);el('custErrMsg').textContent=e.message;}).addCustomer({id,name,phone,address:v('cAddr')});
  else setTimeout(()=>{hideSpinner();showIA('custOk');toast('গ্রাহক যোগ! (Demo)','s');},500);
}

function renderCustomers() {
  setText('custCount',G.customers.length+' জন');
  const tbody=el('custTbody');
  if(!G.customers.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-users"></i><p>কোনো গ্রাহক নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=G.customers.map(c=>`<tr>
    <td class="mono" style="font-size:.75rem">${esc(c.id)}</td>
    <td class="fw7">${esc(c.name)}</td>
    <td>${esc(c.phone||'—')}</td>
    <td class="mono ${c.due>0?'text-d fw7':''}">${c.due>0?'৳'+fmt(c.due):'—'}</td>
    <td class="mono">${c.totalPaid?'৳'+fmt(c.totalPaid):'—'}</td>
    <td>
      <button class="btn-icon me-1" onclick="editCustomer('${esc(c.id)}')" title="এডিট"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon del" onclick="confirmDeleteCust('${esc(c.id)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>
    </td>
  </tr>`).join('');
}

function editCustomer(custId) {
  const c=G.customers.find(x=>x.id===custId);if(!c)return;
  G.editTarget={type:'customer',id:custId};
  setText('editModalTitle','গ্রাহক এডিট: '+c.name);
  el('editModalBody').innerHTML=`<div class="row g-2">
    <div class="col-6"><div class="fg"><label class="flbl">নাম</label><input type="text" class="fc" id="em_name" value="${esc(c.name||'')}"/></div></div>
    <div class="col-6"><div class="fg"><label class="flbl">ফোন</label><input type="text" class="fc" id="em_phone" value="${esc(c.phone||'')}"/></div></div>
    <div class="col-12"><div class="fg"><label class="flbl">ঠিকানা</label><input type="text" class="fc" id="em_addr" value="${esc(c.address||'')}"/></div></div>
  </div>`;
  showModal('editModal');
}

function confirmDeleteCust(custId) {
  if(!confirm('গ্রাহক মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteCustomer(custId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}

// ════════════════════════════════════════════════════════════
// SUPPLIERS
// ════════════════════════════════════════════════════════════
function submitSupplier() {
  hideIA('supErr');hideIA('supOk');
  const id=v('sId').trim(),name=v('sName').trim(),phone=v('sPhone').trim();
  if(!id||!name||!phone){showIA('supErr','সব তথ্য দিন।');el('supErrMsg').textContent='সব তথ্য দিন।';return;}
  showSpinner('নিবন্ধন হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('supOk');toast(r.message,'s');['sId','sName','sPhone','sAddr'].forEach(i=>el(i).value='');refreshAll();}else{showIA('supErr',r?.message||'ব্যর্থ!');el('supErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('supErr',e.message);el('supErrMsg').textContent=e.message;}).addSupplier({id,name,phone,address:v('sAddr')});
  else setTimeout(()=>{hideSpinner();showIA('supOk');toast('সরবরাহকারী যোগ! (Demo)','s');},500);
}

function renderSuppliers() {
  setText('supCount',G.suppliers.length+' জন');
  const tbody=el('supTbody');
  if(!G.suppliers.length){tbody.innerHTML=`<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-building"></i><p>কোনো সরবরাহকারী নেই</p></div></td></tr>`;return;}
  tbody.innerHTML=G.suppliers.map(s=>`<tr>
    <td class="mono" style="font-size:.75rem">${esc(s.id)}</td>
    <td class="fw7">${esc(s.name)}</td>
    <td>${esc(s.phone||'—')}</td>
    <td class="mono ${s.totalPayable>0?'text-d fw7':''}">${s.totalPayable>0?'৳'+fmt(s.totalPayable):'—'}</td>
    <td class="mono">${s.totalPaid?'৳'+fmt(s.totalPaid):'—'}</td>
    <td><button class="btn-icon del" onclick="confirmDeleteSup('${esc(s.id)}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button></td>
  </tr>`).join('');
}

function confirmDeleteSup(supId) {
  if(!confirm('সরবরাহকারী মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteSupplier(supId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}

// ════════════════════════════════════════════════════════════
// ACCOUNTS / DUE / PAYMENT
// ════════════════════════════════════════════════════════════
function renderDueLedger() {
  const dueCusts=G.customers.filter(c=>c.due>0).sort((a,b)=>b.due-a.due);
  setText('dueCount',dueCusts.length+' জন');
  const container=el('dueLedger');
  if(!dueCusts.length){container.innerHTML=`<div class="empty"><i class="fa-solid fa-circle-check"></i><p>কোনো বকেয়া নেই!</p></div>`;return;}
  container.innerHTML=dueCusts.map(c=>`
    <div class="due-row-item">
      <div class="di-info">
        <h6><i class="fa-solid fa-user me-1" style="color:var(--accent)"></i>${esc(c.name)}</h6>
        <p><i class="fa-solid fa-phone me-1"></i>${esc(c.phone||'—')} &bull; ID: ${esc(c.id)}</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="di-due">৳${fmt(c.due)}</div>
        <button class="btn-s btn-sm" onclick="quickPay('${esc(c.id)}')"><i class="fa-solid fa-money-bill-wave"></i> পরিশোধ</button>
      </div>
    </div>`).join('');

  // update SD options for payment
  const dueCustOpts=buildCustOpts(dueCusts,false);
  sdSetOptions('sdPayCust',dueCustOpts);
}

function quickPay(custId) {
  goTab('accounts');
  setTimeout(()=>{
    sdClear('sdPayCust');
    const cust=G.customers.find(c=>c.id===custId);
    if(cust){ sdSelect('sdPayCust',custId,cust.name+(cust.due>0?` — ৳${fmt(cust.due)}`:''));onPayCustSelect(custId); }
  },100);
}

function onPayCustSelect(val) {
  const id=val||sdGetValue('sdPayCust');
  const cust=G.customers.find(c=>c.id===id);
  el('payCurrDue').value=cust?'৳'+fmt(cust.due):'';
}

function submitPayment() {
  hideIA('payErr');hideIA('payOk');
  const custId=sdGetValue('sdPayCust'),amount=parseFloat(v('payAmt'))||0,date=v('payDate');
  const cust=G.customers.find(c=>c.id===custId);
  if(!cust){showIA('payErr','গ্রাহক নির্বাচন করুন।');el('payErrMsg').textContent='গ্রাহক নির্বাচন করুন।';return;}
  if(amount<=0){showIA('payErr','পরিমাণ দিন।');el('payErrMsg').textContent='পরিমাণ দিন।';return;}
  if(amount>cust.due+0.01){showIA('payErr','বাকির চেয়ে বেশি হতে পারে না।');el('payErrMsg').textContent='বাকির চেয়ে বেশি হতে পারে না।';return;}
  showSpinner('পরিশোধ গ্রহণ হচ্ছে...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('payOk');toast(r.message,'s');sdClear('sdPayCust');el('payCurrDue').value='';el('payAmt').value='';refreshAll();}else{showIA('payErr',r?.message||'ব্যর্থ!');el('payErrMsg').textContent=r?.message||'';}}).withFailureHandler(e=>{hideSpinner();showIA('payErr',e.message);el('payErrMsg').textContent=e.message;}).receiveDuePayment({customerId:custId,amount,date});
  } else setTimeout(()=>{hideSpinner();showIA('payOk');toast('পরিশোধ গৃহীত! (Demo)','s');},500);
}

function submitExpense() {
  hideIA('expOk');
  const desc=v('expDesc').trim(),amount=parseFloat(v('expAmt'))||0,date=v('expDate'),cat=v('expCat');
  if(!desc||amount<=0){toast('বিবরণ ও পরিমাণ দিন।','w');return;}
  showSpinner('সংরক্ষণ হচ্ছে...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('expOk');toast(r.message,'s');el('expDesc').value='';el('expAmt').value='';refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).addExpense({description:desc,amount,date,category:cat});
  } else setTimeout(()=>{hideSpinner();showIA('expOk');toast('খরচ রেকর্ড হয়েছে! (Demo)','s');},500);
}

function confirmDeleteExp(expId) {
  if(!confirm('খরচ মুছবেন?'))return;
  showSpinner('মুছা হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){toast(r.message,'s');refreshAll();}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).deleteExpense(expId);
  else setTimeout(()=>{hideSpinner();toast('মুছা হয়েছে (Demo)','s');},500);
}

// ════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════
function loadCfgForm(r) {
  if(r.pharmacyName) el('cfgName').value=r.pharmacyName;
  if(r.ownerName)    el('cfgOwner').value=r.ownerName;
  if(r.phone)        el('cfgPhone').value=r.phone;
  if(r.address)      el('cfgAddr').value=r.address;
  if(r.lowStockLevel)el('cfgLow').value=r.lowStockLevel;
  if(r.dbUrl){el('cfgDbUrl').href=r.dbUrl;el('dbLinkBtn').href=r.dbUrl;}
  if(r.dbId)         el('cfgDbId').value=r.dbId;
}

function saveSettings() {
  hideIA('cfgOk');
  const data={pharmacyName:v('cfgName').trim(),ownerName:v('cfgOwner').trim(),phone:v('cfgPhone').trim(),address:v('cfgAddr').trim(),lowStockLevel:v('cfgLow')};
  if(!data.pharmacyName){toast('ফার্মেসির নাম দিন।','w');return;}
  showSpinner('সংরক্ষণ হচ্ছে...');
  if(isGAS()){
    google.script.run.withSuccessHandler(r=>{hideSpinner();if(r&&r.success){showIA('cfgOk');toast(r.message,'s');G.pharmaName=data.pharmacyName;setText('pharmaName',G.pharmaName);}else toast(r?.message||'ব্যর্থ!','d');}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).saveConfig(data);
  } else setTimeout(()=>{hideSpinner();showIA('cfgOk');toast('সংরক্ষিত! (Demo)','s');},500);
}

function runSetup() {
  showSpinner('শিট মেরামত হচ্ছে...');
  if(isGAS()) google.script.run.withSuccessHandler(r=>{hideSpinner();toast(r?.message||'সম্পন্ন!',r?.success?'s':'d');if(r?.success)refreshAll();}).withFailureHandler(e=>{hideSpinner();toast(e.message,'d');}).runSetup();
  else setTimeout(()=>{hideSpinner();toast('Setup সম্পন্ন! (Demo)','s');},500);
}

function updateDbLink() {
  if(G.dbUrl&&G.dbUrl!=='#'){el('dbLinkBtn').href=G.dbUrl;el('cfgDbUrl').href=G.dbUrl;el('cfgDbId').value=G.dbId;}
}

// ════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════
const TAB_NAMES={dashboard:'ড্যাশবোর্ড',pos:'বিক্রয় (POS)',medicine:'ওষুধ মাস্টার',inventory:'ইনভেন্টরি',purchase:'ক্রয়',opening:'পূর্বের হিসাব',customers:'গ্রাহক',suppliers:'সরবরাহকারী',accounts:'অ্যাকাউন্টস',settings:'সেটিংস'};

function goTab(tabId) {
  // ✅ ফিক্স: Admin ট্যাব ছেড়ে গেলে realtime listener বন্ধ করা — নাহলে সারা
  // সেশনজুড়ে ব্যাকগ্রাউন্ডে users কালেকশনের প্রতিটা পরিবর্তনে অপ্রয়োজনীয়
  // read + re-render চলতে থাকে
  if (APP_STATE.currentTab === 'admin' && tabId !== 'admin' && typeof adminUsersUnsub === 'function') {
    adminUsersUnsub();
    adminUsersUnsub = null;
  }

  APP_STATE.currentTab = tabId;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.tab === tabId;
    link.classList.toggle('bg-brand/20', active);
    link.classList.toggle('text-white', active);
    link.classList.toggle('text-white/60', !active);
  });

  setText('header-title', TAB_TITLES[tabId] || tabId);
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    if (tabId === 'dashboard') { setText('dash-date', formatTodayBn()); renderDashboardModule(); }
    if (tabId === 'pos') { renderPOSModule(); }
    if (tabId === 'analytics') { renderAnalyticsModule(); }
    if (tabId === 'purchase') { renderPurchaseModule(); }
    if (tabId === 'returns') { renderReturnsModule(); }
    if (tabId === 'opening') { renderOpeningModule(); }
    if (tabId === 'inventory') { renderInventoryModule(); }
    if (tabId === 'medicine') { renderMedicineModule(); }
    if (tabId === 'customers') { renderCustomersModule(); }
    if (tabId === 'suppliers') { renderSuppliersModule(); }
    if (tabId === 'accounts') { renderAccountsModule(); }
    if (tabId === 'settings') { renderSettingsModule(); }
    if (tabId === 'admin') { renderAdminModule(); }
    if (tabId === 'ads') { renderAdsModule(); }
  } catch (err) {
    showFatalError('goTab("' + tabId + '") এ সমস্যা:\n' + err.message);
  }
}

function toggleSb(){el('sb').classList.toggle('open');el('sbo').classList.toggle('show');}
function closeSb(){el('sb').classList.remove('open');el('sbo').classList.remove('show');}
function showModal(id){el(id).classList.add('show');}
function closeModal(id){el(id).classList.remove('show');G.editTarget=null;}

// ════════════════════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════════════════════
function loMsg(m){setText('loMsg',m);}
function hideOverlay(){el('lo').classList.add('hide');}
function showSpinner(m){setText('msMsg',m||'প্রক্রিয়াকরণ...');el('ms').classList.add('on');}
function hideSpinner(){el('ms').classList.remove('on');}
function showIA(id,msg){const e=el(id);if(!e)return;e.classList.add('show');if(msg){const s=e.querySelector('span');if(s)s.textContent=msg;}setTimeout(()=>e.classList.remove('show'),5000);}
function hideIA(id){el(id)?.classList.remove('show');}
function show(id){el(id).style.display='flex';}
function hide(id){el(id).style.display='none';}

function toast(msg,type='s') {
  const icons={s:'fa-circle-check',d:'fa-circle-exclamation',w:'fa-triangle-exclamation'};
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<i class="fa-solid ${icons[type]||icons.s}"></i><div class="toast-msg">${esc(msg)}</div>`;
  el('tc').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(40px)';t.style.transition='all .3s ease';setTimeout(()=>t.remove(),300);},3200);
}

function setTodayDates() {
  const td=todayStr();
  ['posDate','purDate','payDate','expDate','obDate'].forEach(id=>{const e=el(id);if(e)e.value=td;});
}

function el(id){return document.getElementById(id);}
function v(id){return el(id)?.value||'';}
function setText(id,t){const e=el(id);if(e)e.textContent=t;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmt(n){return parseFloat(n||0).toLocaleString('bn-BD',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtK(n){n=parseFloat(n||0);return n>=100000?(n/100000).toFixed(1)+'L':n>=1000?(n/1000).toFixed(1)+'K':fmt(n);}
function todayStr(){return new Date().toISOString().split('T')[0];}
function round2(n){return Math.round((n+Number.EPSILON)*100)/100;}
function isGAS(){return typeof google!=='undefined'&&google.script;}

function parseExpiryDate(exp) {
  if(!exp)return null;
  const p=String(exp).split('/');
  if(p.length===2)return new Date(parseInt(p[1]),parseInt(p[0]),0);
  const d=new Date(exp);return isNaN(d.getTime())?null:d;
}

// ════════════════════════════════════════════════════════════
// MOCK DATA
// ════════════════════════════════════════════════════════════
function getMockData() {
  const today=todayStr();
  return {
    medicines:[
      {id:'MED-0001',brand:'নাপা',generic:'Paracetamol',doseForm:'ট্যাবলেট',strength:'500mg',category:'এনালজেসিক',reorderLevel:20},
      {id:'MED-0002',brand:'সেকলো',generic:'Omeprazole',doseForm:'ক্যাপসুল',strength:'20mg',category:'এন্টাসিড',reorderLevel:15},
      {id:'MED-0003',brand:'এজিথ্রো',generic:'Azithromycin',doseForm:'ট্যাবলেট',strength:'500mg',category:'এন্টিবায়োটিক',reorderLevel:10},
    ],
    customers:[
      {id:'C-0001',name:'রহিম মিয়া',phone:'01711111111',due:850,totalPaid:1200},
      {id:'C-0002',name:'সুমাইয়া বেগম',phone:'01822222222',due:0,totalPaid:500},
      {id:'C-0003',name:'করিম সাহেব',phone:'01933333333',due:1250,totalPaid:0},
    ],
    suppliers:[
      {id:'S-0001',name:'স্কয়ার ফার্মা',phone:'02111111111',totalPayable:5000,totalPaid:20000},
      {id:'S-0002',name:'বেক্সিমকো ফার্মা',phone:'02222222222',totalPayable:0,totalPaid:8000},
    ],
    inventory:[
      {medId:'MED-0001',brand:'নাপা',doseForm:'ট্যাবলেট',strength:'500mg',totalStock:200,costValue:1000,mrpValue:1600,sellPrice:8,nearestExpiry:'12/2026',status:'ok',batches:[{batchId:'BAT-001',expiry:'12/2026',stock:200,cost:5,mrp:8,sell:8}]},
      {medId:'MED-0002',brand:'সেকলো',doseForm:'ক্যাপসুল',strength:'20mg',totalStock:8,costValue:80,mrpValue:120,sellPrice:15,nearestExpiry:'06/2025',status:'low',batches:[{batchId:'BAT-002',expiry:'06/2025',stock:8,cost:10,mrp:15,sell:15}]},
      {medId:'MED-0003',brand:'এজিথ্রো',doseForm:'ট্যাবলেট',strength:'500mg',totalStock:0,costValue:0,mrpValue:0,sellPrice:65,nearestExpiry:'',status:'out',batches:[]},
    ],
    sales:[
      {invoiceNo:'INV-001',date:today,customerName:'রহিম মিয়া',customerId:'C-0001',medicineName:'নাপা',totalBill:480,cashPaid:480,due:0,type:'নগদ'},
      {invoiceNo:'INV-002',date:today,customerName:'করিম সাহেব',customerId:'C-0003',medicineName:'সেকলো',totalBill:270,cashPaid:0,due:270,type:'বাকি'},
      {invoiceNo:'INV-003',date:today,customerName:'নগদ গ্রাহক',customerId:'WALK_IN',medicineName:'নাপা',totalBill:120,cashPaid:120,due:0,type:'নগদ'},
    ],
    purchases:[
      {purchaseId:'PUR-001',date:today,invoiceNo:'PUR-001',supplierName:'স্কয়ার ফার্মা',supplierId:'S-0001',medicineName:'নাপা',qty:500,purchasePrice:5,totalCost:2500,paymentType:'নগদ'},
    ],
    expenses:[
      {id:'EXP-001',date:today,description:'বিদ্যুৎ বিল',amount:1200,category:'ইউটিলিটি'},
      {id:'EXP-002',date:today,description:'কর্মীর বেতন',amount:8000,category:'বেতন'},
    ],
    dbUrl:'#',dbId:'demo',
  };
}
</script>
</body>
</html>

const fs=require('fs');
const p='src/public/css/cosmos-ui-polish.css';
let s=fs.readFileSync(p,'utf8');
const i=s.indexOf('.overlay.open .modal.modal--create-request .sp-create-request-submit-btn,');
const j=s.indexOf('.modal.modal--create-request .sp-create-request-store-line {', i);
if(i<0||j<0) throw new Error('range not found');
const good=`  .overlay.open .modal.modal--create-request .sp-create-request-submit-btn,
  .overlay.open .modal.modal--create-request .sp-create-request-clear-btn {
    width: 100%;
    min-height: 48px;
    justify-content: center;
    font-size: 15px;
    border-radius: 12px;
    touch-action: manipulation;
  }

  .overlay.open .modal.modal--create-request .sp-create-request-submit-btn {
    font-weight: 700;
  }

  .overlay.open .modal.modal--create-request .sp-create-request-clear-btn {
    background: transparent;
    border-color: transparent;
    color: var(--text2, #64748b);
    min-height: 40px;
  }

`;
s=s.slice(0,i)+good+s.slice(j);
fs.writeFileSync(p,s);
console.log('ok');

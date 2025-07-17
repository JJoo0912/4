/* Fan Bubble App JS
 * Handles member list, profile view, chat view, nickname storage, data loading.
 * + 추가: More 메뉴, Update 문의, 관리자 메뉴(News/Upload), 실시간 채팅 반영 등
 */

const MEMBER_LIST = [
  {id:"Gunil", display:"건일"},
  {id:"Jeongsu", display:"정수"},
  {id:"Gaon", display:"가온"},
  {id:"Ode", display:"오드"},
  {id:"Junhan", display:"준한"},
  {id:"Jooyeon", display:"주연"},
];

// --- Utilities ---
function qs(sel,root=document){return root.querySelector(sel);}
function qsa(sel,root=document){return [...root.querySelectorAll(sel)];}
function getParam(name){
  const p=new URLSearchParams(location.search);
  return p.get(name);
}
function getNickname(){
  return localStorage.getItem("fanNickname") || "";
}
function setNickname(nick){
  localStorage.setItem("fanNickname", nick);
}

function getMemberDisplay(id){
  const m = MEMBER_LIST.find(x=>x.id===id);
  return m ? m.display : id;
}

function profileSrc(id){
  return `images/${id}_profile.jpg`;
}
function backgroundSrc(id){
  return `images/${id}_background.jpg`;
}

function dataSrc(id){
  return `data/${id}.json`;
}

function formatDateK(dateStr){
  const d = new Date(dateStr);
  if(!isNaN(d)){
    const y=d.getFullYear();
    const m=d.getMonth()+1;
    const day=d.getDate();
    const weekday=["일","월","화","수","목","금","토"][d.getDay()];
    return `${y}년 ${m}월 ${day}일 ${weekday}요일`;
  }
  return dateStr;
}

// --- 저장된 문의사항들 (Update 문의) ---
let inquiryList = JSON.parse(localStorage.getItem("inquiryList") || "[]");

// --- 저장된 채팅 데이터 임시 메모리 (Upload 후 실시간 반영용) ---
let chatDataCache = {}; // { memberId: [ {...}, ... ] }

// --- Archive (index.html) ---
function initArchive(){
  const listEl = qs("#archiveList");
  if(!listEl) return;

  MEMBER_LIST.forEach(m=>{
    const row=document.createElement("a");
    row.className="archive-row";
    row.href=`member.html?m=${m.id}`;

    row.innerHTML=`
      <span class="archive-row-avatar-wrap">
        <img class="archive-row-avatar" src="${profileSrc(m.id)}" alt="${m.display}"
             onerror="this.src='images/default_profile.jpg'">
      </span>
      <span class="archive-row-name">${m.display}</span>
      <span class="archive-row-status"> </span>
    `;
    listEl.appendChild(row);
  });

  // More 메뉴 토글 기능 추가
  const moreBtn = qs("#moreBtn");
  const membersBtn = qs("#membersBtn");
  const moreSubmenu = qs("#moreSubmenu");

  if(moreBtn && moreSubmenu && membersBtn){
    moreBtn.addEventListener("click", ()=>{
      const isVisible = moreSubmenu.style.display === "flex" || moreSubmenu.style.display === "block";
      if(isVisible){
        moreSubmenu.style.display = "none";
        moreBtn.classList.remove("tab-btn--active");
        membersBtn.classList.add("tab-btn--active");
      } else {
        moreSubmenu.style.display = "flex";
        moreSubmenu.style.flexDirection = "column";
        moreBtn.classList.add("tab-btn--active");
        membersBtn.classList.remove("tab-btn--active");
      }
    });

    membersBtn.addEventListener("click", ()=>{
      moreSubmenu.style.display = "none";
      moreBtn.classList.remove("tab-btn--active");
      membersBtn.classList.add("tab-btn--active");
    });
  }

  // Update, Manager 버튼 이벤트 연결
  const updateBtn = qs("#updateBtn");
  const managerBtn = qs("#managerBtn");

  if(updateBtn){
    updateBtn.addEventListener("click", ()=>{
      openModal("updateModal");
      moreSubmenu.style.display = "none";
      membersBtn.classList.add("tab-btn--active");
      moreBtn.classList.remove("tab-btn--active");
    });
  }

  if(managerBtn){
    managerBtn.addEventListener("click", ()=>{
      openModal("managerPwModal");
      moreSubmenu.style.display = "none";
      membersBtn.classList.add("tab-btn--active");
      moreBtn.classList.remove("tab-btn--active");
    });
  }

  // 멤버 셀렉트 박스 옵션 채우기 (Update / Upload 모두)
  fillMemberSelects();
  fillTimeSelect();
  attachUpdateSendHandler();
  attachManagerPwHandler();
  attachManagerMenuButtons();
  attachUploadHandlers();
  attachAlertModalHandler();
}

function fillMemberSelects(){
  const selects = ["updateMemberSelect","uploadMemberSelect"];
  selects.forEach(selId=>{
    const sel = qs(`#${selId}`);
    if(!sel) return;
    sel.innerHTML = "";
    MEMBER_LIST.forEach(m=>{
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.display;
      sel.appendChild(opt);
    });
  });
}

function fillTimeSelect(){
  const timeSelect = qs("#uploadTimeSelect");
  if(!timeSelect) return;
  timeSelect.innerHTML = "";
  // 오전 12:00 ~ 11:59, 오후 12:00 ~ 11:59 (30분 단위)
  const periods = ["오전", "오후"];
  periods.forEach(period=>{
    for(let h=12; h<=23; h++){
      let hour12 = h === 12 ? 12 : h - 12;
      for(let m of [0,30]){
        let mm = m===0 ? "00" : "30";
        let option = document.createElement("option");
        option.value = `${period} ${hour12}:${mm}`;
        option.textContent = `${period} ${hour12}:${mm}`;
        timeSelect.appendChild(option);
      }
      if(h===23) break; // 23시까지만
    }
  });
  // 그리고 오전 1:00 ~ 11:30 도 추가 (아래로)
  for(let h=1; h<=11; h++){
    for(let m of [0,30]){
      let mm = m===0 ? "00" : "30";
      ["오전","오후"].forEach(period=>{
        let option = document.createElement("option");
        option.value = `${period} ${h}:${mm}`;
        option.textContent = `${period} ${h}:${mm}`;
        timeSelect.appendChild(option);
      });
    }
  }
}

// 모달 열기 닫기 공통 함수
function openModal(id){
  const modal = qs(`#${id}`);
  if(modal) modal.classList.remove("hidden");
}
function closeModal(id){
  const modal = qs(`#${id}`);
  if(modal) modal.classList.add("hidden");
}

// 알림창 띄우기
function showAlert(title, message){
  const alertTitle = qs("#alertTitle");
  const alertMessage = qs("#alertMessage");
  if(alertTitle) alertTitle.textContent = title;
  if(alertMessage) alertMessage.textContent = message;
  openModal("alertModal");
}

function attachAlertModalHandler(){
  const alertModal = qs("#alertModal");
  if(!alertModal) return;
  // 닫기 버튼은 html에 있음
}

// Update 문의 보내기 버튼 핸들러
function attachUpdateSendHandler(){
  const sendBtn = qs("#sendUpdateBtn");
  if(!sendBtn) return;
  sendBtn.onclick = () => {
    const memberSel = qs("#updateMemberSelect");
    const dateInp = qs("#updateDateInput");
    const contentInp = qs("#updateContentInput");

    const member = memberSel?.value;
    const date = dateInp?.value;
    const content = contentInp?.value.trim();

    if(!member){
      showAlert("입력 오류", "멤버를 선택해주세요.");
      return;
    }
    if(!date){
      showAlert("입력 오류", "날짜를 선택해주세요.");
      return;
    }
    if(!content){
      showAlert("입력 오류", "문의 내용을 입력해주세요.");
      return;
    }

    // 문의사항 저장 (localStorage)
    inquiryList.push({member, date, content, timestamp:Date.now()});
    localStorage.setItem("inquiryList", JSON.stringify(inquiryList));

    // 입력 초기화 및 모달 닫기
    if(memberSel) memberSel.value = MEMBER_LIST[0]?.id || "";
    if(dateInp) dateInp.value = "";
    if(contentInp) contentInp.value = "";

    closeModal("updateModal");
    showAlert("문의 완료", "문의사항이 전송되었습니다.");
  };
}

// 관리자 비밀번호 입력 핸들러
function attachManagerPwHandler(){
  const submitBtn = qs("#managerPwSubmitBtn");
  if(!submitBtn) return;
  submitBtn.onclick = () => {
    const pwInput = qs("#managerPwInput");
    const pw = pwInput?.value || "";
    if(pw === "0912"){
      closeModal("managerPwModal");
      openModal("managerMenuModal");
      if(pwInput) pwInput.value = "";
    } else {
      showAlert("접근 거부", "관리자 전용 메뉴입니다.");
      if(pwInput) pwInput.value = "";
    }
  };
}

// 관리자 메뉴 버튼 핸들러 (News, Upload)
function attachManagerMenuButtons(){
  const newsBtn = qs("#newsBtn");
  const uploadBtn = qs("#uploadBtn");

  if(newsBtn){
    newsBtn.onclick = () => {
      closeModal("managerMenuModal");
      openModal("newsModal");
      renderNewsList();
    };
  }
  if(uploadBtn){
    uploadBtn.onclick = () => {
      closeModal("managerMenuModal");
      openModal("uploadModal");
      resetUploadForm();
    };
  }
}

// 문의사항 목록 렌더링 (News)
function renderNewsList(){
  const newsListEl = qs("#newsList");

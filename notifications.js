// ============================================================
// NOTIFICATIONS
// ============================================================
function initNotifications(){
  const enabled = localStorage.getItem('notifEnabled') === 'true';
  const toggle = document.getElementById('notifToggle');
  const timeRow = document.getElementById('notifTimeRow');
  const timeInput = document.getElementById('notifTime');
  if(toggle) toggle.classList.toggle('on', enabled);
  if(timeRow) timeRow.style.display = enabled ? 'flex' : 'none';
  const savedTime = localStorage.getItem('notifTime');
  if(savedTime && timeInput) timeInput.value = savedTime;
}

async function toggleNotification(){
  const toggle = document.getElementById('notifToggle');
  const timeRow = document.getElementById('notifTimeRow');
  const isOn = toggle.classList.contains('on');
  if(!isOn){
    if('Notification' in window){
      const perm = await Notification.requestPermission();
      if(perm === 'granted'){
        toggle.classList.add('on');
        timeRow.style.display = 'flex';
        localStorage.setItem('notifEnabled','true');
        scheduleNotification();
      } else {
        alert('Please enable notifications in your browser/phone settings.');
      }
    }
  } else {
    toggle.classList.remove('on');
    timeRow.style.display = 'none';
    localStorage.setItem('notifEnabled','false');
  }
}

function saveNotifTime(){
  const time = document.getElementById('notifTime').value;
  localStorage.setItem('notifTime', time);
  scheduleNotification();
}

function scheduleNotification(){
  const time = localStorage.getItem('notifTime') || '09:00';
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if(next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    if(Notification.permission === 'granted' && localStorage.getItem('notifEnabled') === 'true'){
      new Notification('PAUSE App — Daily Detox Reminder 🌿', {
        body: "Don't forget today's digital detox challenge! Open PAUSE App to check in.",
        icon: '/Pause-App/icons/icon-192.png'
      });
      scheduleNotification();
    }
  }, delay);
}
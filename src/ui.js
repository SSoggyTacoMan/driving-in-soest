const $ = (id) => document.getElementById(id);

function money(value) {
  const n = Math.max(0, Math.round(value));
  return `€ ${n.toLocaleString('nl-NL')}`;
}

export class UI {
  constructor() {
    this.el = {
      money: $('moneyValue'),
      rides: $('rideValue'),
      missionKicker: $('missionKicker'),
      missionDistance: $('missionDistance'),
      missionTitle: $('missionTitle'),
      missionPassenger: $('missionPassenger'),
      missionFare: $('missionFare'),
      missionProgress: $('missionProgress'),
      missionHint: $('missionHint'),
      bearing: $('bearingArrow'),
      clock: $('clockValue'),
      clockLabel: $('clockLabel'),
      speed: $('speedValue'),
      gear: $('gearValue'),
      surface: $('surfaceValue'),
      speedBar: $('speedBar'),
      minimapDir: $('minimapDir'),
      dialogue: $('dialogue'),
      dialogueAvatar: $('dialogueAvatar'),
      dialogueName: $('dialogueName'),
      dialogueText: $('dialogueText'),
      rideCard: $('rideCard'),
      rideCardKicker: $('rideCardKicker'),
      rideCardFare: $('rideCardFare'),
      rideCardNames: $('rideCardNames'),
      rideCardRoute: $('rideCardRoute'),
      toast: $('toast'),
      toastKicker: $('toastKicker'),
      toastTitle: $('toastTitle'),
      toastText: $('toastText'),
      menu: $('menu'),
      pause: $('pauseModal'),
      help: $('helpModal'),
      photoHint: $('photoHint'),
      soundBtn: $('soundBtn'),
      pauseSoundBtn: $('pauseSoundBtn'),
      pauseTimeBtn: $('pauseTimeBtn'),
      minimap: $('minimap'),
      loader: $('loader'),
      speedo: $('speedo'),
      mobileControls: $('mobileControls'),
    };
    this.toastTimer = null;
    this.rideTimer = null;
    this.dialogueTimer = null;
    this.lastSpeed = -1;
    this.lastMoney = -1;
    this.lastRides = -1;
    this.lastGear = '';
    this.lastSurface = '';
    this.lastMission = {};
    this.hideTimers = [];
  }

  loadingDone() {
    this.el.loader.classList.add('done');
    setTimeout(() => this.el.loader.classList.add('hidden'), 1000);
  }

  hideMenu() {
    this.el.menu.classList.add('closing');
    setTimeout(() => this.el.menu.classList.add('hidden'), 950);
  }

  showMenu() {
    this.el.menu.classList.remove('hidden', 'closing');
  }

  enterGame() {
    document.body.classList.add('playing');
    document.body.classList.remove('photo');
    this.hideMenu();
  }

  setPhoto(on) {
    document.body.classList.toggle('photo', on);
    this.el.photoHint.style.display = on ? '' : 'none';
  }

  setPhotoHintVisible(on) {
    document.body.classList.toggle('photo', on);
  }

  setPaused(on) {
    this.el.pause.classList.toggle('open', on);
  }

  setHelp(on) {
    this.el.help.classList.toggle('open', on);
  }

  setMuted(muted) {
    const label = muted ? 'SOUND OFF' : 'SOUND ON';
    if (this.el.soundBtn) this.el.soundBtn.textContent = label;
    if (this.el.pauseSoundBtn) this.el.pauseSoundBtn.textContent = muted ? 'Sound: off' : 'Sound: on';
  }

  setTimeLabel(presetLabel, clock) {
    this.el.clockLabel.textContent = presetLabel;
    this.el.clock.textContent = clock;
  }

  setMoney(value, rides) {
    if (value !== this.lastMoney) {
      this.el.money.textContent = money(value);
      this.lastMoney = value;
    }
    if (rides !== this.lastRides) {
      this.el.rides.textContent = `${rides} ride${rides === 1 ? '' : 's'}`;
      this.lastRides = rides;
    }
  }

  setSpeed(kmh, gear, surface) {
    const rounded = Math.round(kmh);
    if (rounded !== this.lastSpeed) {
      this.el.speed.textContent = String(rounded);
      this.el.speedBar.style.width = `${Math.min(100, (kmh / 112) * 100)}%`;
      this.lastSpeed = rounded;
    }
    if (gear !== this.lastGear) {
      this.el.gear.textContent = gear;
      this.lastGear = gear;
    }
    if (surface !== this.lastSurface) {
      this.el.surface.textContent = surface;
      this.lastSurface = surface;
    }
  }

  setMinimapAngle(yaw) {
    const deg = 180 - (yaw * 180) / Math.PI;
    this.el.minimapDir.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
  }

  setBearing(angleRad) {
    this.el.bearing.style.transform = `rotate(${(angleRad * 180) / Math.PI}deg)`;
  }

  setMission(data) {
    if ('kicker' in data && data.kicker !== this.lastMission.kicker) {
      this.el.missionKicker.textContent = data.kicker;
      this.lastMission.kicker = data.kicker;
    }
    if ('distance' in data) this.el.missionDistance.textContent = data.distance;
    if ('title' in data && data.title !== this.lastMission.title) {
      this.el.missionTitle.textContent = data.title;
      this.lastMission.title = data.title;
    }
    if ('passenger' in data && data.passenger !== this.lastMission.passenger) {
      this.el.missionPassenger.textContent = data.passenger;
      this.lastMission.passenger = data.passenger;
    }
    if ('fare' in data) this.el.missionFare.textContent = data.fare;
    if ('hint' in data && data.hint !== this.lastMission.hint) {
      this.el.missionHint.textContent = data.hint;
      this.lastMission.hint = data.hint;
    }
    if ('progress' in data) {
      this.el.missionProgress.style.width = `${Math.max(0, Math.min(100, data.progress))}%`;
    }
  }

  showRideCard({ fare, names, route, kicker = 'NEW RIDE' }) {
    this.el.rideCardKicker.textContent = kicker;
    this.el.rideCardFare.textContent = fare;
    this.el.rideCardNames.textContent = names;
    this.el.rideCardRoute.textContent = route;
    this.el.rideCard.classList.add('show');
    clearTimeout(this.rideTimer);
    this.rideTimer = setTimeout(() => this.el.rideCard.classList.remove('show'), 5600);
  }

  hideRideCard() {
    this.el.rideCard.classList.remove('show');
  }

  showToast({ kicker = 'RIDE COMPLETE', title, text, duration = 3600 }) {
    this.el.toastKicker.textContent = kicker;
    this.el.toastTitle.textContent = title;
    this.el.toastText.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), duration);
  }

  showDialogue({ name, text, duration = 5200 }) {
    this.el.dialogueAvatar.textContent = (name || '?').slice(0, 1).toUpperCase();
    this.el.dialogueName.textContent = name;
    this.el.dialogueText.textContent = text;
    this.el.dialogue.classList.add('show');
    clearTimeout(this.dialogueTimer);
    this.dialogueTimer = setTimeout(() => this.el.dialogue.classList.remove('show'), duration);
  }

  hideDialogue() {
    this.el.dialogue.classList.remove('show');
  }
}

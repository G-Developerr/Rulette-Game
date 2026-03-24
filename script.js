const wheelNumbers = Array.from({ length: 37 }, (_, index) => index);
const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

let balance = 450;
let wins = 0;
let losses = 0;
let isSpinning = false;
let currentRotation = 0;
const spinHistory = [];

function getNumberColor(number) {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function buildWheelGradient() {
  const slice = 100 / wheelNumbers.length;
  const stops = wheelNumbers.map((number, i) => {
    const start = (i * slice).toFixed(3);
    const end = ((i + 1) * slice).toFixed(3);
    const color = getNumberColor(number);
    const colorValue = color === "green" ? "#0f8e45" : color === "red" ? "#ba2027" : "#141414";
    return `${colorValue} ${start}% ${end}%`;
  });
  document.getElementById("roulette-spinner").style.setProperty("--wheel-gradient", `conic-gradient(${stops.join(",")})`);
}

function createRouletteNumbers() {
  const numbersContainer = document.getElementById("roulette-numbers");
  const rouletteContainer = document.querySelector(".roulette-container");
  numbersContainer.innerHTML = "";
  const containerSize = rouletteContainer ? rouletteContainer.clientWidth : 320;
  const radius = (containerSize / 2) - 28;
  const degreesPerNumber = 360 / wheelNumbers.length;

  wheelNumbers.forEach((number, index) => {
    const angle = degreesPerNumber * index;
    const x = radius * Math.cos(((angle - 90) * Math.PI) / 180);
    const y = radius * Math.sin(((angle - 90) * Math.PI) / 180);

    const numberElement = document.createElement("div");
    numberElement.className = "roulette-number";
    numberElement.textContent = number;
    numberElement.style.left = `calc(50% + ${x}px)`;
    numberElement.style.top = `calc(50% + ${y}px)`;
    numberElement.style.color = getNumberColor(number) === "black" ? "#e7e7e7" : "#ffffff";
    numberElement.style.transform = `translate(-50%, -50%) rotate(${angle + 90}deg)`;
    numbersContainer.appendChild(numberElement);
  });
}

function updateBalanceDisplay() {
  document.getElementById("balance-display").textContent = `Balance: $${balance}`;
}

function updateStats(lastResultText = "-") {
  document.getElementById("stats").textContent = `Wins: ${wins} | Losses: ${losses} | Last result: ${lastResultText}`;
}

function setBetAmount(amount) {
  document.getElementById("bet-amount").value = amount;
}

function setStatus(message, isWin) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${isWin ? "green" : "red"}`;
}

function renderHistory() {
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";
  spinHistory.slice(0, 8).forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    historyList.appendChild(li);
  });
}

function updateBetInputs() {
  const type = document.getElementById("bet-type").value;
  document.getElementById("number-field").classList.toggle("hidden", type !== "number");
  document.getElementById("color-field").classList.toggle("hidden", type !== "color");
  document.getElementById("odd-even-field").classList.toggle("hidden", type !== "oddEven");
  document.getElementById("high-low-field").classList.toggle("hidden", type !== "highLow");
}

function getBetConfig() {
  const betType = document.getElementById("bet-type").value;
  const config = { type: betType, value: null, multiplier: 2, label: "" };

  if (betType === "number") {
    const value = parseInt(document.getElementById("bet-value-number").value, 10);
    if (Number.isNaN(value) || value < 0 || value > 36) return null;
    config.value = value;
    config.multiplier = 35;
    config.label = `Number ${value}`;
    return config;
  }
  if (betType === "color") {
    config.value = document.getElementById("bet-value-color").value;
    config.label = config.value.toUpperCase();
    return config;
  }
  if (betType === "oddEven") {
    config.value = document.getElementById("bet-value-odd-even").value;
    config.label = config.value.toUpperCase();
    return config;
  }

  config.value = document.getElementById("bet-value-high-low").value;
  config.label = config.value.toUpperCase();
  return config;
}

function isWinningBet(betConfig, number) {
  if (betConfig.type === "number") return number === betConfig.value;
  if (betConfig.type === "color") return number !== 0 && getNumberColor(number) === betConfig.value;
  if (betConfig.type === "oddEven") {
    if (number === 0) return false;
    return betConfig.value === "odd" ? number % 2 !== 0 : number % 2 === 0;
  }
  if (number === 0) return false;
  return betConfig.value === "low" ? number >= 1 && number <= 18 : number >= 19 && number <= 36;
}

function playGame() {
  if (isSpinning) return;

  const betAmount = parseInt(document.getElementById("bet-amount").value, 10);
  const betConfig = getBetConfig();
  const spinButton = document.getElementById("spin-button");

  if (Number.isNaN(betAmount) || betAmount <= 0 || betAmount > balance || !betConfig) {
    setStatus("Invalid bet setup. Check amount and selected option.", false);
    return;
  }

  const spinner = document.getElementById("roulette-spinner");
  const numbers = document.getElementById("roulette-numbers");
  const degreesPerNumber = 360 / wheelNumbers.length;

  // Pick a random winning index
  const winningIndex = Math.floor(Math.random() * wheelNumbers.length);
  const winningNumber = wheelNumbers[winningIndex];

  // The pointer is at the top (0deg). 
  // We need the winning slice to end up under the pointer.
  // Each number sits at: index * degreesPerNumber degrees from the top of the wheel.
  // To bring winningIndex under the pointer we rotate by:
  //   fullSpins  +  (360 - winningIndex * degreesPerNumber)
  // BUT we also need to cancel out whatever rotation the wheel already has (currentRotation % 360).

  const spins = (Math.floor(Math.random() * 4) + 6) * 360;
  const targetAngle = winningIndex * degreesPerNumber;
  const previousRemainder = currentRotation % 360;
  const extraNeeded = (360 - targetAngle - previousRemainder + 360) % 360;

  currentRotation += spins + extraNeeded;

  isSpinning = true;
  spinButton.disabled = true;
  spinButton.textContent = "Spinning...";

  spinner.style.transition = "transform 4.2s cubic-bezier(0.18, 0.72, 0.25, 1)";
  numbers.style.transition = "transform 4.2s cubic-bezier(0.18, 0.72, 0.25, 1)";
  spinner.style.transform = `rotate(${currentRotation}deg)`;
  numbers.style.transform = `rotate(${currentRotation}deg)`;

  setTimeout(() => {
    const hasWon = isWinningBet(betConfig, winningNumber);
    const numberColor = getNumberColor(winningNumber);
    const payout = hasWon ? betAmount * betConfig.multiplier : 0;

    if (hasWon) {
      wins += 1;
      balance += payout;
      setStatus(`Win! ${winningNumber} (${numberColor.toUpperCase()}) landed. You earned $${payout}.`, true);
    } else {
      losses += 1;
      balance -= betAmount;
      setStatus(`Lose! ${winningNumber} (${numberColor.toUpperCase()}) landed.`, false);
    }

    spinHistory.unshift(
      `#${spinHistory.length + 1} | Bet: ${betConfig.label} $${betAmount} | Result: ${winningNumber} ${numberColor} | ${hasWon ? "WIN" : "LOSE"}`
    );

    updateBalanceDisplay();
    updateStats(`${winningNumber} ${numberColor}`);
    renderHistory();

    isSpinning = false;
    spinButton.disabled = false;
    spinButton.textContent = "Spin Roulette";

    if (balance <= 0) {
      spinButton.disabled = true;
      setStatus("Game over! Click Reset Game to play again.", false);
    }
  }, 4200);
}

function resetGame() {
  balance = 450;
  wins = 0;
  losses = 0;
  currentRotation = 0;
  isSpinning = false;
  spinHistory.length = 0;

  const spinner = document.getElementById("roulette-spinner");
  const numbers = document.getElementById("roulette-numbers");
  const spinButton = document.getElementById("spin-button");

  spinner.style.transition = "none";
  numbers.style.transition = "none";
  spinner.style.transform = "rotate(0deg)";
  numbers.style.transform = "rotate(0deg)";
  void spinner.offsetWidth;

  spinButton.disabled = false;
  spinButton.textContent = "Spin Roulette";
  document.getElementById("bet-amount").value = "";
  document.getElementById("bet-value-number").value = "";

  updateBalanceDisplay();
  updateStats("-");
  renderHistory();
  setStatus("New game started. Place your bet and spin.", true);
}

window.onload = () => {
  buildWheelGradient();
  createRouletteNumbers();
  updateBalanceDisplay();
  updateStats("-");
  renderHistory();
  document.getElementById("bet-type").addEventListener("change", updateBetInputs);
  updateBetInputs();
  window.addEventListener("resize", createRouletteNumbers);
};

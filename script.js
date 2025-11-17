const totalNumbers = 38;
let balance = 450;
let currentRotation = 0;

function createRouletteNumbers() {
    const numbersContainer = document.getElementById("roulette-numbers");
    const radius = 140;

    for (let i = 1; i <= totalNumbers; i++) {
        const angle = (360 / totalNumbers) * i;
        const x = radius * Math.cos(((angle - 90) * Math.PI) / 180);
        const y = radius * Math.sin(((angle - 90) * Math.PI) / 180);

        const numberElement = document.createElement("div");
        numberElement.className = "roulette-number";
        numberElement.textContent = i;
        numberElement.style.left = `calc(50% + ${x}px)`;
        numberElement.style.top = `calc(50% + ${y}px)`;
        numberElement.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        numbersContainer.appendChild(numberElement);
    }
}

function updateBalanceDisplay() {
    document.getElementById("balance-display").textContent = `Total Balance: $${balance}`;
}

function setBetAmount(amount) {
    document.getElementById("bet-amount").value = amount;
}

function playGame() {
    const spinner = document.getElementById("roulette-spinner");
    const numbers = document.getElementById("roulette-numbers");
    const betAmount = parseInt(document.getElementById("bet-amount").value);
    const guessNumber = parseInt(document.getElementById("guess-number").value);
    const status = document.getElementById("status");

    function calculateWinningNumber(rotation, totalNumbers) {
        const degreesPerNumber = 360 / totalNumbers; // Μοίρες για κάθε αριθμό
        const normalizedRotation = rotation % 360; // Κανονικοποιημένη περιστροφή (0 - 359 μοίρες)
        const winningIndex = Math.round(normalizedRotation / degreesPerNumber); // Στρογγυλοποίηση για τον κοντινότερο αριθμό
        return winningIndex === 0 ? totalNumbers : totalNumbers - winningIndex;
    }

    if (!betAmount ||
        betAmount <= 0 ||
        betAmount > balance ||
        !guessNumber ||
        guessNumber < 1 ||
        guessNumber > 38
    ) {
        status.textContent = "Invalid bet or guess!";
        status.className = "status red";
        return;
    }

    const spins = Math.floor(Math.random() * 5) + 5;
    const degreesPerNumber = 360 / totalNumbers;
    const randomStop = Math.floor(Math.random() * totalNumbers);
    const targetRotation = 360 * spins + randomStop * degreesPerNumber;

    spinner.style.transition = "transform 4s ease-out";
    numbers.style.transition = "transform 4s ease-out";

    spinner.style.transform = `rotate(${targetRotation}deg)`;
    numbers.style.transform = `rotate(${targetRotation}deg)`; // Περιστροφή των αριθμών

    setTimeout(() => {
        const winningNumber = calculateWinningNumber(targetRotation, totalNumbers);
        if (winningNumber === guessNumber) {
            balance += betAmount * 3;
            status.textContent = `You won! The winning number is ${winningNumber}.`;
            status.className = "status green";
        } else {
            balance -= betAmount;
            status.textContent = `You lost! The winning number is ${winningNumber}.`;
            status.className = "status red";
        }
        updateBalanceDisplay();
    }, 4000);
}

window.onload = createRouletteNumbers;
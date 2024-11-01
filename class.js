
const periodTimes = {
    "１": "08:10 ~ 09:00",
    "２": "09:10 ~ 10:00",
    "３": "10:10 ~ 11:00",
    "４": "11:10 ~ 12:00",
    "Ｅ": "12:10 ~ 13:00",
    "５": "13:10 ~ 14:00",
    "６": "14:10 ~ 15:00",
    "７": "15:10 ~ 16:00",
    "８": "16:10 ~ 17:00",
    "９": "17:10 ~ 18:20",
    "Ａ": "18:25 ~ 19:15",
    "Ｂ": "19:20 ~ 20:10",
    "Ｃ": "20:20 ~ 21:10",
    "Ｄ": "21:15 ~ 22:05"
};

const timetableData = [];
const rows = document.querySelectorAll("table tr");

for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td");
    const row = [];
    cells.forEach((cell, index) => {
        if (index === 0) {
            const period = cell.innerText.trim();
            row.push(`${period}\n${periodTimes[period] || ""}`);
        } else {
            row.push(cell.innerText.trim());
        }
    });
    timetableData.push(row);
}

const customTable = document.createElement("div");
customTable.style.cssText = "display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; max-width: 800px; margin: 20px auto; font-family: Arial, sans-serif; font-weight: bold;";

const headers = ["節次", "一", "二", "三", "四", "五", "六", "日"];
headers.forEach(headerText => {
    const header = document.createElement("div");
    header.innerText = headerText;
    header.style.cssText = "background: #8B0000; color: white; text-align: center; padding: 8px; font-weight: bold;";
    customTable.appendChild(header);
});

timetableData.forEach(row => {
    row.forEach(cellText => {
        const cell = document.createElement("div");
        cell.innerText = cellText;
        cell.style.cssText = "background: #f8f8f8; color: #000; padding: 5px; text-align: center; border: 1px solid #ddd; font-weight: bold; cursor: pointer; min-width: 80px; min-height: 50px; max-width: 80px; max-height: 50px; font-size: 12px; transition: background-color 0.3s ease;"; 
        const colors = ["#98FB98", "#FFD700", "#FF6347", "#f8f8f8"];
        let clickCount = 0; 

        cell.addEventListener("click", () => {
            cell.style.backgroundColor = colors[clickCount % colors.length]; 
            clickCount++; 
        });

        customTable.appendChild(cell);
    });
});

let textCode = '';
timetableData.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
        if (colIndex > 0 && cell) { 
            const day = headers[colIndex];
            const period = rowIndex + 1; 
            textCode += `#${day}${period}:${cell.replace(/\n/g, " ")} `;
        }
    });
});

const textCodeContainer = document.createElement("div");
textCodeContainer.style.cssText = "text-align: center; font-size: 14px; margin-bottom: 10px;";
textCodeContainer.innerText = textCode.trim();

const copyButton = document.createElement("button");
copyButton.innerText = "複製代碼";
copyButton.style.cssText = "display: block; margin: 0 auto 20px; padding: 10px 20px; background-color: #8B0000; color: white; border: none; cursor: pointer;";
copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(textCode.trim());
    alert("已複製到剪貼簿！");
});

const note = document.createElement("div");
note.innerText = "備註：節次9之表示方法有二：789節之[17:10 ~ 18:00] 或 9AB節之[17:30 ~ 18:20]";
note.style.cssText = "text-align: center; font-size: 14px; margin-top: 20px; color: #333; font-weight: bold;";

document.body.innerHTML = "";
document.body.appendChild(textCodeContainer);
document.body.appendChild(copyButton);
document.body.appendChild(customTable);
document.body.appendChild(note);



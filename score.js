
const scoreContainer = document.createElement("div");
scoreContainer.id = "allScoresContainer";
scoreContainer.style.margin = "20px";
scoreContainer.style.transform = "scale(0.69)"; 
scoreContainer.style.transformOrigin = "top left"; 

const headerDiv = document.getElementById("header");
if (headerDiv) {
    scoreContainer.style.marginLeft = "265px"; 
    headerDiv.appendChild(scoreContainer);
} else {
    console.error("找不到具有 id='header' 的 div");
}
const studentNumberElement = document.querySelector(".dropdown-item");
const studentNameElement = document.querySelector(".fas.fa-user.me-1");

const studentNumber = studentNumberElement ? studentNumberElement.textContent.trim() : "學號未找到";
const studentName = studentNameElement ? studentNameElement.nextSibling.textContent.trim() : "姓名未找到";

const titleContainer = document.createElement("div");
titleContainer.style.textAlign = "center"; 
titleContainer.style.fontSize = "24px"; 
titleContainer.style.fontWeight = "bold"; 
titleContainer.style.margin = "20px 0"; 
titleContainer.textContent = "東吳大學學生歷年成績表";

const descriptionContainer = document.createElement("div");
descriptionContainer.style.margin = "20px 0"; 
descriptionContainer.style.textAlign = "right";
descriptionContainer.style.paddingRight = "20px";
descriptionContainer.style.fontWeight = "bold"; 
descriptionContainer.textContent = `學號：${studentNumber} 姓名：${studentName}`;

scoreContainer.insertBefore(descriptionContainer, scoreContainer.firstChild);
scoreContainer.insertBefore(titleContainer, descriptionContainer); 

const scoreYearSelect = document.getElementById("scoreYearSelect");
const selectedYears = Array.from(scoreYearSelect.options).map(option => option.value);

const scoresData = {};

selectedYears.forEach(year => {
    const table = document.getElementById(`${year}_scoreTable`);
    if (table) {
        const rows = table.querySelectorAll("tbody tr");
        const semester = year.endsWith("01") ? "第一學期" : "第二學期";
        const baseYear = year.substring(0, 4); 

        rows.forEach(row => {
            const courseCode = row.cells[0].innerText;
            const courseName = row.cells[1].innerText;
            const classType = row.cells[2].innerText;
            const creditsText = row.cells[3].innerText;
            const gradeText = row.cells[4].innerText;

            const credits = parseFloat(creditsText);
            const grade = isNaN(parseFloat(gradeText)) ? gradeText : parseFloat(gradeText);

            if (!scoresData[baseYear]) {
                scoresData[baseYear] = {};
            }
            if (!scoresData[baseYear][courseCode]) {
                scoresData[baseYear][courseCode] = { courseName, classType, 第一學期: null, 第二學期: null };
            }

            scoresData[baseYear][courseCode][semester] = { credits, grade };
        });
    }
});

const allTablesContainer = document.createElement("div");
allTablesContainer.style.display = "flex";
allTablesContainer.style.width = "900px"; 
allTablesContainer.style.justifyContent = "space-between"; 
allTablesContainer.style.gap = "0px"; 
allTablesContainer.style.fontWeight = "bold"; 
scoreContainer.appendChild(allTablesContainer);

let cumulativeCredits = 0; 

Object.keys(scoresData).sort().forEach(year => {
    const scoresTable = document.createElement("table");
    scoresTable.classList.add("table", "table-bordered", "text-center");
    scoresTable.style.width = "2900px"; 
    scoresTable.style.tableLayout = "auto";
    scoresTable.style.height = "900px"; 
    scoresTable.style.borderCollapse = "collapse"; 
    scoresTable.innerHTML = `<tbody></tbody>`;
    const tableBody = scoresTable.querySelector("tbody");

const yearNumber = parseInt(year.substring(3, 5)); 
const baseYear = year.substring(0, 3); 

const nextYear = (yearNumber + 1) < 10 ? `0${yearNumber + 1}` : `${yearNumber + 1}`;
const formattedYear = `${baseYear}學年\n${baseYear}年9月 至 ${baseYear + 1}年7月`; 

const yearRow = document.createElement("tr");
const yearCell = document.createElement("td");
yearCell.colSpan = 6;
yearCell.innerText = year;
yearCell.innerText = formattedYear; 
yearCell.style.fontWeight = "bold";
yearCell.style.height = "50px"; 
yearRow.appendChild(yearCell);
tableBody.appendChild(yearRow);

    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `
        <th style="width: 200px; white-space: nowrap;">選別</th>
        <th style="white-space: nowrap; width: 900px;">科目</th>
        <th colspan="2" style="white-space: nowrap;">第一學期</th>
        <th colspan="2" style="white-space: nowrap;">第二學期</th>
    `;
    headerRow.style.height = "50px"; 
    tableBody.appendChild(headerRow);

    let firstSemesterGradePoints = 0; 
    let firstSemesterTotalCredits = 0; 
    let firstSemesterPassedCredits = 0; 

    let secondSemesterGradePoints = 0; 
    let secondSemesterTotalCredits = 0; 
    let secondSemesterPassedCredits = 0; 

const totalCourses = 26;

let currentCourseCount = 0;

Object.keys(scoresData[year]).forEach(courseCode => {
    const course = scoresData[year][courseCode];
    const firstSemester = course["第一學期"];
    const secondSemester = course["第二學期"];
    let row;
    

    if (firstSemester && !secondSemester) {

        row = document.createElement("tr");
        row.innerHTML = `
            <td style="width: 200px; white-space: nowrap;">${course.classType}</td>
            <td style="white-space: nowrap; width: 900px;">${course.courseName}</td>
            <td style="width: 60px; white-space: nowrap;">${firstSemester.credits}</td>
            <td style="width: 60px; white-space: nowrap;">${isNaN(firstSemester.grade) ? firstSemester.grade : firstSemester.grade}</td>
            <td></td><td></td>
        `;
        row.style.height = "50px"; 
        row.style.borderTop = "0px solid #ccc"; 
        row.style.borderBottom = "0px solid #ccc";
        if (!isNaN(firstSemester.grade)) {
            firstSemesterGradePoints += firstSemester.grade * firstSemester.credits;
            firstSemesterTotalCredits += firstSemester.credits;
            if (firstSemester.grade >= 60 || firstSemester.grade === "通過") {
                firstSemesterPassedCredits += firstSemester.credits;
            }
        } else if (firstSemester.grade === "通過") {
            firstSemesterPassedCredits += firstSemester.credits;
        }
        tableBody.appendChild(row);
        currentCourseCount++;
    } else if (firstSemester && secondSemester) {
        row = document.createElement("tr");
        row.innerHTML = `
            <td style="width: 200px; white-space: nowrap;">${course.classType}</td>
            <td style="white-space: nowrap; width: 900px;">${course.courseName}</td>
            <td style="width: 60px; white-space: nowrap;">${firstSemester.credits}</td>
            <td style="width: 60px; white-space: nowrap;">${isNaN(firstSemester.grade) ? firstSemester.grade : firstSemester.grade}</td>
            <td style="width: 60px; white-space: nowrap;">${secondSemester.credits}</td>
            <td style="width: 60px; white-space: nowrap;">${isNaN(secondSemester.grade) ? secondSemester.grade : secondSemester.grade}</td>
        `;
        row.style.height = "50px";
        row.style.borderTop = "0px solid #ccc";
        row.style.borderBottom = "0px solid #ccc"; 
        if (!isNaN(firstSemester.grade)) {
            firstSemesterGradePoints += firstSemester.grade * firstSemester.credits;
            firstSemesterTotalCredits += firstSemester.credits;
            if (firstSemester.grade >= 60 || firstSemester.grade === "通過") {
                firstSemesterPassedCredits += firstSemester.credits;
            }
        } else if (firstSemester.grade === "通過") {
            firstSemesterPassedCredits += firstSemester.credits;
        }
        if (!isNaN(secondSemester.grade)) {
            secondSemesterGradePoints += secondSemester.grade * secondSemester.credits;
            secondSemesterTotalCredits += secondSemester.credits;
            if (secondSemester.grade >= 60 || secondSemester.grade === "通過") {
                secondSemesterPassedCredits += secondSemester.credits;
            }
        } else if (secondSemester.grade === "通過") {
            secondSemesterPassedCredits += secondSemester.credits;
        }
        tableBody.appendChild(row);
        currentCourseCount++;
    } else if (!firstSemester && secondSemester) {
        row = document.createElement("tr");
        row.innerHTML = `
            <td style="width: 200px; white-space: nowrap;">${course.classType}</td>
            <td style="white-space: nowrap; width: 900px;">${course.courseName}</td>
            <td></td><td></td>
            <td style="width: 60px; white-space: nowrap;">${secondSemester.credits}</td>
            <td style="width: 60px; white-space: nowrap;">${isNaN(secondSemester.grade) ? secondSemester.grade : secondSemester.grade}</td>
        `;
        row.style.height = "50px"; 
        row.style.borderTop = "0px solid #ccc"; 
        row.style.borderBottom = "0px solid #ccc"; 
        if (!isNaN(secondSemester.grade)) {
            secondSemesterGradePoints += secondSemester.grade * secondSemester.credits;
            secondSemesterTotalCredits += secondSemester.credits;
            if (secondSemester.grade >= 60 || secondSemester.grade === "通過") {
                secondSemesterPassedCredits += secondSemester.credits;
            }
        } else if (secondSemester.grade === "通過") {
            secondSemesterPassedCredits += secondSemester.credits;
        }
        tableBody.appendChild(row);
        currentCourseCount++;
    }
    
});

const emptyRowsNeeded = totalCourses - currentCourseCount;
for (let i = 0; i < emptyRowsNeeded; i++) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
    `;
    emptyRow.style.height = "50px"; 
    emptyRow.style.borderTop = "0px solid #ccc"; 
    emptyRow.style.borderBottom = "0px solid #ccc"; 
    tableBody.appendChild(emptyRow);
}
    const firstSemesterGPA = firstSemesterTotalCredits > 0 ? (firstSemesterGradePoints / firstSemesterTotalCredits).toFixed(2) : 0;
    const secondSemesterGPA = secondSemesterTotalCredits > 0 ? (secondSemesterGradePoints / secondSemesterTotalCredits).toFixed(2) : 0;

    const gpaStatsRow = document.createElement("tr");
    gpaStatsRow.innerHTML = `
        <td colspan="2" style="font-weight:bold;">學業平均分數</td>
        <td colspan="2">${firstSemesterGPA}</td>
        <td colspan="2">${secondSemesterGPA}</td>
    `;
    gpaStatsRow.style.height = "50px"; 
    tableBody.appendChild(gpaStatsRow);

    const creditStatsRow = document.createElement("tr");
    creditStatsRow.innerHTML = `
        <td colspan="2" style="font-weight:bold;">實得學分數</td>
        <td colspan="2">${firstSemesterPassedCredits}</td>
        <td colspan="2">${secondSemesterPassedCredits}</td>
    `;
    creditStatsRow.style.height = "50px"; 
    tableBody.appendChild(creditStatsRow);

    cumulativeCredits += firstSemesterPassedCredits;
    const cumulativeCreditsFirst = cumulativeCredits;
    cumulativeCredits += secondSemesterPassedCredits;
    const cumulativeCreditsSecond = cumulativeCredits;

    const cumulativeCreditsRow = document.createElement("tr");
    cumulativeCreditsRow.innerHTML = `
        <td colspan="2" style="font-weight:bold;">累積學分數</td>
        <td colspan="2">${cumulativeCreditsFirst}</td>
        <td colspan="2">${cumulativeCreditsSecond}</td>
    `;
    cumulativeCreditsRow.style.height = "50px"; 
    tableBody.appendChild(cumulativeCreditsRow);

    allTablesContainer.appendChild(scoresTable);
});

scoreContainer.appendChild(allTablesContainer);

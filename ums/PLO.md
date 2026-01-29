To explain the calculation logic to your coding agent, you need to break down the process into three distinct phases based on the mathematical formulas provided in the sources.

In your SQL table, the **Weight** column represents the "Set Weight Score". This is the percentage of the total course grade (100%) allocated to a specific Assessment-CLO-PLO link.

### **Phase 1: Calculate Individual Student PLO Scores**
According to the sources, a student's score for a specific PLO within a course is the sum of the weighted marks from all assessments that map to it.

**Logic for your Coding Agent:**
1.  **Join** your `Student_Marks` table with your `Weight_Mapping` table on `assessmentId`.
2.  **Multiply** the student's normalized score (e.g., their percentage on the quiz) by the `Weight` from your mapping table.
3.  **Sum** these values for each student, grouped by `PLOId`.

*   **Source Formula:** $\text{PLO Score} = \sum (\text{Weight of CLO to PLO} \times \text{Student's CLO Score})$.

### **Phase 2: Calculate the Maximum Possible PLO Score**
To render an "average achievement percentage" for a PLO, you first need to know the maximum possible points a student could have earned for that PLO in your course.

**Logic for your Coding Agent:**
1.  In your `Weight_Mapping` table, **Sum** the `Weight` column for each unique `PLOId`.
2.  This sum is the **Total Weight for that PLO**. For example, if CLO1 and CLO2 both map to PLO1 and their assessment weights are 20% and 30% respectively, the max weight for PLO1 in that course is **50**.

### **Phase 3: Calculate Course-Wide PLO Attainment**
The sources define "PLO Attainment" or "Average Achievement" as the percentage of students who meet the passing threshold (usually 50%), or simply the mean percentage of the cohort.

**Logic for your Coding Agent:**
1.  **Individual Percentage:** Divide each student's `Total PLO Score` (from Phase 1) by the `Total Weight for that PLO` (from Phase 2).
2.  **Cohort Average:** Calculate the **Average (Mean)** of these individual percentages across all students in the course.
3.  **Threshold Check:** Compare the cohort average against the success criteria. The sources state a PLO is generally considered "achieved" if the average score is **$\ge$ 50%**.

### **Aggregating for Semester Reports (The "Credit Weight" Step)**
If your agent needs to calculate the average PLO achievement across **multiple courses** for a semester report, the sources require a **Credit Weight (CW)** calculation:
*   **Formula:** $\text{Credit Weight (CW)} = \text{Total Weight for the PLO in that Course} \times \text{Course Credits}$.
*   **Aggregation:** The average PLO achievement for the semester is the $\frac{\sum (\text{Credit Weight} \times \text{Achievement \%})}{\sum \text{Total Credit Weights}}$.

**Summary for the Developer:**
*   **Student Level:** `SUM(Student_Mark * Mapping_Weight)` / `SUM(Mapping_Weight)`.
*   **Course Level:** `AVG(Student_Individual_Percentages)`.
*   **Key Source Tip:** Ensure the agent handles the scenario where one assessment (like a final exam) is split across multiple CLOs or PLOs by using the unique `Weight` assigned to each link in your mapping table.
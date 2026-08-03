import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

os.makedirs("report_assets", exist_ok=True)

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'

# 1. GENERATE USE CASE DIAGRAM
fig, ax = plt.subplots(figsize=(10, 7), dpi=300)
ax.set_xlim(0, 10)
ax.set_ylim(0, 8)
ax.axis('off')

# System Boundary Box
rect = patches.FancyBboxPatch((2.2, 0.5), 7.2, 7.0, boxstyle="round,pad=0.3", 
                             ec="#0284c7", fc="#f8fafc", lw=2)
ax.add_patch(rect)
ax.text(5.8, 7.2, "Tensor Decomposer System Boundary", fontsize=13, fontweight='bold', ha='center', color="#0f172a")

# Actor (User)
ax.add_patch(patches.Circle((1.0, 4.5), 0.35, ec="#1e293b", fc="#e2e8f0", lw=2)) # Head
ax.plot([1.0, 1.0], [3.5, 4.15], color="#1e293b", lw=2) # Body
ax.plot([0.5, 1.5], [3.8, 3.8], color="#1e293b", lw=2) # Arms
ax.plot([1.0, 0.6], [3.5, 2.7], color="#1e293b", lw=2) # Left Leg
ax.plot([1.0, 1.4], [3.5, 2.7], color="#1e293b", lw=2) # Right Leg
ax.text(1.0, 2.3, "User / Data Scientist\n(Researcher)", fontsize=10, fontweight='bold', ha='center', color="#1e293b")

# Use Cases (Ellipses)
use_cases = [
    (3.5, 6.0, "UC-1: Input / Upload Tensor Data"),
    (6.5, 6.0, "UC-2: Select Decomposition Algorithm\n(CP, Tucker, HOSVD, TT, SVD, QR, LU)"),
    (3.5, 4.3, "UC-3: Execute Decomposition &\nFormat Matrix Outputs"),
    (6.5, 4.3, "UC-4: Analyze Accuracy &\nError Metrics (MAE, RMSE)"),
    (3.5, 2.6, "UC-5: Benchmark FLOPs &\nExecution Speed"),
    (6.5, 2.6, "UC-6: Compare Multiple\nDecomposition Methods"),
    (5.0, 1.2, "UC-7: Render Interactive 3D\nEquation & Spectrum Visuals")
]

for x, y, label in use_cases:
    ellipse = patches.Ellipse((x, y), 2.7, 1.0, ec="#0284c7", fc="#e0f2fe", lw=1.8)
    ax.add_patch(ellipse)
    ax.text(x, y, label, fontsize=8.5, fontweight='bold', ha='center', va='center', color="#0369a1")

# Associations (Lines from Actor to System Boundary Use Cases)
ax.annotate("", xy=(2.35, 6.0), xytext=(1.4, 4.2), arrowprops=dict(arrowstyle="-", color="#334155", lw=1.5))
ax.annotate("", xy=(2.35, 4.3), xytext=(1.4, 4.0), arrowprops=dict(arrowstyle="-", color="#334155", lw=1.5))
ax.annotate("", xy=(2.35, 2.6), xytext=(1.4, 3.8), arrowprops=dict(arrowstyle="-", color="#334155", lw=1.5))
ax.annotate("", xy=(3.8, 1.2), xytext=(1.4, 3.5), arrowprops=dict(arrowstyle="-", color="#334155", lw=1.5))

plt.tight_layout()
plt.savefig("report_assets/use_case_diagram.png", bbox_inches='tight')
plt.close()

# 2. GENERATE ACTIVITY DIAGRAM
fig, ax = plt.subplots(figsize=(8, 10), dpi=300)
ax.set_xlim(0, 8)
ax.set_ylim(0, 12)
ax.axis('off')

# Start State
ax.add_patch(patches.Circle((4.0, 11.5), 0.25, ec="#1e293b", fc="#1e293b"))
ax.text(4.0, 11.8, "Start", fontsize=10, fontweight='bold', ha='center')

# Activity Nodes
activities = [
    (10.2, "User Provides Tensor Input\n(Manual JSON / Upload File)"),
    (8.8, "Validate Input Format &\nDetermine Tensor Dimensions"),
    (7.0, "Decision: Is Input Valid?"),
    (5.4, "Execute Selected Algorithm\n(CP-ALS / HOOI / HOSVD / TT)"),
    (3.8, "Reconstruct Tensor & Compute\nError Metrics (MAE, RMSE, Rel. Error)"),
    (2.2, "Calculate FLOPs, Complexity,\n& Format Matrix Output"),
    (0.8, "Render 3D Isometric Visuals,\nBar Spectra & Heatmaps")
]

for y, label in activities:
    if "Decision" in label:
        # Diamond
        diamond = patches.Polygon([[4.0, y+0.5], [5.5, y], [4.0, y-0.5], [2.5, y]], 
                                  ec="#d97706", fc="#fef3c7", lw=2)
        ax.add_patch(diamond)
        ax.text(4.0, y, label, fontsize=8.5, fontweight='bold', ha='center', va='center', color="#b45309")
    else:
        box = patches.FancyBboxPatch((2.0, y-0.45), 4.0, 0.9, boxstyle="round,pad=0.2", 
                                  ec="#0284c7", fc="#e0f2fe", lw=1.8)
        ax.add_patch(box)
        ax.text(4.0, y, label, fontsize=9, fontweight='bold', ha='center', va='center', color="#0369a1")

# Error State Node for Invalid Input
err_box = patches.FancyBboxPatch((6.2, 6.55), 1.6, 0.9, boxstyle="round,pad=0.2", ec="#dc2626", fc="#fee2e2", lw=1.8)
ax.add_patch(err_box)
ax.text(7.0, 7.0, "Display Error\nMessage", fontsize=8, fontweight='bold', ha='center', va='center', color="#991b1b")

# End State
ax.add_patch(patches.Circle((4.0, 0.0), 0.25, ec="#1e293b", fc="#ffffff", lw=2))
ax.add_patch(patches.Circle((4.0, 0.0), 0.15, ec="#1e293b", fc="#1e293b"))
ax.text(4.0, -0.4, "End", fontsize=10, fontweight='bold', ha='center')

# Connectors (Arrows)
arrows = [
    ((4.0, 11.25), (4.0, 10.65)),
    ((4.0, 9.75), (4.0, 9.25)),
    ((4.0, 8.35), (4.0, 7.5)),
    ((4.0, 6.5), (4.0, 5.85)), # Yes path
    ((4.0, 4.95), (4.0, 4.25)),
    ((4.0, 3.35), (4.0, 2.65)),
    ((4.0, 1.75), (4.0, 1.25)),
    ((4.0, 0.35), (4.0, 0.25))
]

for start, end in arrows:
    ax.annotate("", xy=end, xytext=start, arrowprops=dict(arrowstyle="->", color="#334155", lw=1.8))

# Branching arrows
ax.annotate("", xy=(6.2, 7.0), xytext=(5.5, 7.0), arrowprops=dict(arrowstyle="->", color="#dc2626", lw=1.8))
ax.text(5.85, 7.15, "No", fontsize=9, fontweight='bold', color="#dc2626")
ax.text(3.7, 6.1, "Yes", fontsize=9, fontweight='bold', color="#16a34a")

plt.tight_layout()
plt.savefig("report_assets/activity_diagram.png", bbox_inches='tight')
plt.close()

# 3. GENERATE GANTT CHART
fig, ax = plt.subplots(figsize=(10, 5), dpi=300)

tasks = [
    "Requirements Gathering & Proposal",
    "System Architecture & Mathematical Design",
    "Core Algorithms Implementation (CP, Tucker, HOSVD, TT)",
    "Matrix Operations (SVD, QR, LU, Eigendecomp)",
    "Frontend Development & UI Design",
    "Interactive SVG & 3D Visualizations",
    "Testing, Benchmarking & Refactoring",
    "Final Technical Report & Presentation"
]

starts = [1, 2, 4, 6, 7, 9, 11, 13]
durations = [2, 3, 4, 2, 4, 3, 3, 3]
colors = ["#3b82f6", "#06b6d4", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#6366f1", "#0284c7"]

y_pos = range(len(tasks))
ax.barh(y_pos, durations, left=starts, height=0.5, color=colors, edgecolor="#1e293b", linewidth=1.2)

ax.set_yticks(y_pos)
ax.set_yticklabels(tasks, fontsize=9.5, fontweight='bold', color="#1e293b")
ax.invert_yaxis()  # top-down

ax.set_xlabel("Project Timeline (Weeks)", fontsize=10, fontweight='bold', color="#1e293b")
ax.set_xlim(0, 16)
ax.set_xticks(range(0, 17, 2))
ax.grid(axis='x', linestyle='--', alpha=0.5)
ax.set_title("Tensor Decomposer Development Gantt Chart (16 Weeks)", fontsize=12, fontweight='bold', color="#0f172a", pad=15)

plt.tight_layout()
plt.savefig("report_assets/gantt_chart.png", bbox_inches='tight')
plt.close()

print("Diagrams successfully generated in report_assets/")

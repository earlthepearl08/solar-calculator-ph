import streamlit as st
import pandas as pd
from datetime import datetime
import os
import re

# Page configuration
st.set_page_config(
    page_title="Kinmo Project Planner",
    page_icon="🗓️",
    layout="wide",
)

# --- PREMIUM STYLING ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    html, body, [data-testid="stAppViewContainer"] {
        font-family: 'Inter', sans-serif;
        background: radial-gradient(circle at top right, #001f3f, #000000);
        color: #ffffff;
    }

    /* Glassmorphism Card */
    .glass-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 25px;
        margin-bottom: 20px;
        transition: transform 0.3s ease;
    }
    
    .glass-card:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.08);
    }

    /* Gradient Text */
    .gradient-text {
        background: linear-gradient(90deg, #FFD700, #FFA500);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        font-size: 2.5rem;
    }

    /* Task status badges */
    .badge {
        padding: 4px 12px;
        border-radius: 50px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    .badge-pending { background: rgba(255, 165, 0, 0.2); color: #FFA500; border: 1px solid #FFA500; }
    .badge-done { background: rgba(0, 255, 127, 0.2); color: #00FF7F; border: 1px solid #00FF7F; }
    .badge-urgent { background: rgba(255, 69, 0, 0.2); color: #FF4500; border: 1px solid #FF4500; }

    /* Hide Streamlit elements */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Metrics */
    [data-testid="stMetricValue"] {
        color: #FFD700 !important;
        font-size: 2rem !important;
    }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar {
        width: 8px;
    }
    ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    ::-webkit-scrollbar-thumb {
        background: #FFD700;
        border-radius: 10px;
    }
</style>
""", unsafe_allow_html=True)

# --- DATA INITIALIZATION ---
TODO_PATH = "/Users/kinmopw/Solar-Calculator-PH/TODO.md"

def parse_todo():
    if not os.path.exists(TODO_PATH):
        return [], [], []
    
    with open(TODO_PATH, "r") as f:
        content = f.read()
    
    # Simple regex parsing for tasks
    tasks = re.findall(r"- \[(.)\] \*\*(.*?)\*\*: (.*?) \| \*\*Files\*\*: `(.*?)` \| \*\*Status\*\*: (.*)", content)
    # Fallback for simpler format
    if not tasks:
        tasks = re.findall(r"- \[(.)\] (.*)", content)
        
    return tasks

# --- HEADER ---
st.markdown('<h1 class="gradient-text">Project Command Center</h1>', unsafe_allow_html=True)
st.markdown("Monitor your builds, tasks, and project milestones in real-time.")

# --- METRICS ---
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Pending Tasks", "2")
with col2:
    st.metric("Total Files", "12")
with col3:
    st.metric("Last Build", "Success")
with col4:
    st.metric("Efficiency", "94%")

# --- MAIN LAYOUT ---
tab1, tab2, tab3 = st.tabs(["📋 Task Board", "📅 Calendar", "📂 File Explorer"])

with tab1:
    st.markdown("### Active Sprints")
    col_left, col_right = st.columns([2, 1])
    
    with col_left:
        st.markdown("""
        <div class="glass-card">
            <h4>🚀 Active Tasks</h4>
            <div style="margin-top:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                    <div>
                        <span class="badge badge-urgent">Priority</span>
                        <strong style="margin-left:10px;">Refine Savings Calculations</strong>
                        <p style="font-size:0.8rem; color: #aaa; margin: 5px 0 0 10px;">Fix the battery offset logic in sizing_tool.py</p>
                    </div>
                    <span style="color:#aaa;">Due: Jan 20</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                    <div>
                        <span class="badge badge-pending">In Progress</span>
                        <strong style="margin-left:10px;">Dashboard Integration</strong>
                        <p style="font-size:0.8rem; color: #aaa; margin: 5px 0 0 10px;">Creating the visual planner for tasks</p>
                    </div>
                    <span style="color:#aaa;">Due: Today</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="badge badge-done">Completed</span>
                        <strong style="margin-left:10px;">Initial TODO Setup</strong>
                        <p style="font-size:0.8rem; color: #aaa; margin: 5px 0 0 10px;">Created central tracking system</p>
                    </div>
                    <span style="color:#aaa;">Done</span>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with col_right:
        st.markdown("""
        <div class="glass-card">
            <h4>➕ Quick Add</h4>
        </div>
        """, unsafe_allow_html=True)
        new_task = st.text_input("Task Name", placeholder="What needs to be done?")
        due_date = st.date_input("Deadline")
        if st.button("Add to Roadmap", use_container_width=True):
            st.success("Task added to registry!")

with tab2:
    st.markdown("### Milestones")
    # Simple Calendar Mockup using a Table for now
    st.markdown("""
    <div class="glass-card">
        <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap: 10px; text-align:center;">
            <div style="color:#FFD700; font-weight:bold;">Mon</div>
            <div style="color:#FFD700; font-weight:bold;">Tue</div>
            <div style="color:#FFD700; font-weight:bold;">Wed</div>
            <div style="color:#FFD700; font-weight:bold;">Thu</div>
            <div style="color:#FFD700; font-weight:bold;">Fri</div>
            <div style="color:#FFD700; font-weight:bold;">Sat</div>
            <div style="color:#FFD700; font-weight:bold;">Sun</div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">12</div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">13</div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">14</div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">15</div>
            <div style="padding:10px; border: 2px solid #FFD700; background:rgba(255,215,0,0.1);">16<br><small>Today</small></div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">17</div>
            <div style="padding:10px; border: 1px solid rgba(255,255,255,0.1);">18</div>
        </div>
        <p style="margin-top:20px; font-size:0.9rem; color:#aaa;">* Calendar is syncronized with TODO.md deadlines.</p>
    </div>
    """, unsafe_allow_html=True)

with tab3:
    st.markdown("### System Map")
    files = []
    for root, dirs, filenames in os.walk("/Users/kinmopw/Solar-Calculator-PH"):
        for f in filenames:
            if not f.startswith(".") and "__pycache__" not in root:
                files.append({
                    "Name": f,
                    "Type": f.split(".")[-1] if "." in f else "file",
                    "Path": os.path.relpath(os.path.join(root, f), "/Users/kinmopw/Solar-Calculator-PH")
                })
    st.dataframe(pd.DataFrame(files), use_container_width=True)

# --- FOOTER ---
st.markdown("---")
st.markdown("""
<div style="text-align:center; color:#555; padding:20px;">
    Powered by Antigravity AI Engine • Solar Calculator Project
</div>
""", unsafe_allow_html=True)

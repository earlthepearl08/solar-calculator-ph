import streamlit as st
import math
import base64
import os

# Get the directory of the current script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Function to encode local images for use in HTML
def get_image_base64(filename):
    path = os.path.join(SCRIPT_DIR, filename)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"
    return ""

# Page configuration
st.set_page_config(
    page_title="Professional AVR Sizing Calculator",
    page_icon="⚡", 
    layout="wide",
    initial_sidebar_state="expanded",
)

# Base64 assets
logo_b64 = get_image_base64('logo.png')
avr1_b64 = get_image_base64('avr1.png')
avr2_b64 = get_image_base64('avr2.png')
avr3_b64 = get_image_base64('avr3.png')
avr_vertical_b64 = get_image_base64('avr_vertical.png')
avr_cabinet_b64 = get_image_base64('avr_cabinet.png')
avr_huge_b64 = get_image_base64('avr_huge.png')

# Premium Design CSS (Streamlit implementation of the HTML/Tailwind look)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;700;800&display=swap');

    :root {
        --primary: #002B5B;
        --secondary: #FACC15;
        --accent: #3B82F6;
        --bg: #F8FAFC;
    }

    .stApp {
        background: radial-gradient(circle at top right, #E0E7FF, #F8FAFC, #F1F5F9);
        color: #1E293B;
        font-family: 'Inter', sans-serif;
    }

    /* Sidebar Styling */
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #002B5B 0%, #001A33 100%) !important;
    }
    section[data-testid="stSidebar"] * {
        color: white !important;
    }
    
    /* Hero Container */
    .hero-container {
        padding: 3rem 2rem;
        background: linear-gradient(135deg, #002B5B 0%, #004F9F 100%);
        border-radius: 2.5rem;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
        box-shadow: 0 20px 40px rgba(0, 43, 91, 0.2);
    }
    
    .outfit {
        font-family: 'Outfit', sans-serif;
    }

    /* Cards */
    .glass-card {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 2rem;
        padding: 2rem;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
        margin-bottom: 1rem;
    }

    .result-card {
        background: white;
        border-radius: 2.5rem;
        padding: 2.5rem;
        border: 1px solid #E2E8F0;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 100%;
    }

    .value-display {
        font-family: 'Outfit', sans-serif;
        font-size: 6rem;
        font-weight: 900;
        background: linear-gradient(to bottom, #002B5B, #3B82F6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1;
        margin: 1.5rem 0;
    }

    .error-box {
        background: #FEF2F2;
        border: 2px solid #FEE2E2;
        color: #991B1B;
        padding: 2rem;
        border-radius: 2rem;
        text-align: center;
        box-shadow: 0 10px 15px -3px rgba(153, 27, 27, 0.1);
    }

    /* Buttons */
    .btn-quote {
        display: block;
        width: 100%;
        background: #0084FF;
        color: white !important;
        padding: 1.5rem;
        border-radius: 1.5rem;
        font-weight: 800;
        text-decoration: none !important;
        text-align: center;
        font-size: 1.5rem;
        text-transform: uppercase;
        letter-spacing: -0.02em;
        transition: all 0.3s ease;
        box-shadow: 0 10px 15px -3px rgba(0, 132, 255, 0.4);
        margin-top: 2rem;
    }

    .btn-quote:hover {
        transform: translateY(-2px);
        background: #0076e6;
        box-shadow: 0 20px 25px -5px rgba(0, 132, 255, 0.5);
    }

    /* Product display */
    .product-display {
        margin-top: 2rem;
        padding: 1.5rem;
        background: #F8FAFC;
        border: 2px dashed #E2E8F0;
        border-radius: 2rem;
    }
    
    .product-img {
        mix-blend-mode: multiply;
        transition: transform 0.3s ease;
    }
    .product-img:hover {
        transform: scale(1.05);
    }

    /* Input overrides */
    div[data-baseweb="select"] > div {
        border-radius: 1rem !important;
    }
    input {
        border-radius: 1rem !important;
    }
</style>
""", unsafe_allow_html=True)

# Logic Constants from HTML
MULTIPLIERS = {
    "Resistive": 1.35, "Inductive": 3.0, "Inverter": 1.8, "Sensitive": 1.6, "Hyper-Sensitive": 2.0
}

VOLTAGES = {
    "Single Phase (1P) 220V": {"id": "1P-220V", "phase": 1, "volt": 220, "buffer": 1.30},
    "Three Phase (3P) 220V": {"id": "3P-220V", "phase": 3, "volt": 220, "buffer": 1.40},
    "Three Phase (3P) 230V": {"id": "3P-230V", "phase": 3, "volt": 230, "buffer": 1.40},
    "Three Phase (3P) 380V": {"id": "3P-380V", "phase": 3, "volt": 380, "buffer": 1.35},
    "Three Phase (3P) 400V": {"id": "3P-400V", "phase": 3, "volt": 400, "buffer": 1.35},
    "Three Phase (3P) 440V": {"id": "3P-440V", "phase": 3, "volt": 440, "buffer": 1.30},
    "Three Phase (3P) 460V": {"id": "3P-460V", "phase": 3, "volt": 460, "buffer": 1.30},
}

# Header
st.markdown(f"""
<div class="hero-container">
    <div style="display: flex; justify-content: center; margin-bottom: 20px;">
        <img src="data:image/png;base64,{base64.b64encode(open(os.path.join(SCRIPT_DIR, 'logo.png'), 'rb').read()).decode() if os.path.exists(os.path.join(SCRIPT_DIR, 'logo.png')) else ''}" style="width: 100px; height: 100px; background: white; padding: 5px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
    </div>
    <h1 class="outfit" style="font-size: 4rem; margin-bottom: 0.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; line-height: 1;">Professional AVR Sizing Calculator</h1>
    <p style="font-size: 1.25rem; opacity: 0.9; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Kinmo PW Corporation | Power Quality Solutions</p>
</div>
""", unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    if logo_b64:
        st.markdown(f'<img src="{logo_b64}" style="width: 100%; border-radius: 50%; background: white; padding: 10px; margin-bottom: 2rem;">', unsafe_allow_html=True)
    st.markdown("---")
    st.markdown("### Kinmo PW Corporation")
    st.info("Powering Excellence. Professional Capacity Calculation Tool for AVR and Power Systems.")
    st.markdown("---")
    st.markdown("#### Contact Engineering")
    st.write("📞 09687269310")
    st.write("✉️ earldy.kpwunibest@gmail.com")

# Main Selection
mode_col = st.columns([1, 2, 1])[1]
with mode_col:
    app_mode = st.selectbox(
        "Select User Type", 
        ["Residential / Commercial", "Industrial"], 
        index=0
    )
    st.markdown("<br>", unsafe_allow_html=True)

is_industrial = "Industrial" in app_mode

# Input/Result Columns
col_input, col_result = st.columns([1.2, 1], gap="large")

with col_input:
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
    st.subheader("System Parameters")
    
    appliance_name = st.text_input(
        "Equipment Description" if not is_industrial else "Industrial Machine / Load Type", 
        placeholder="e.g., Central Aircon Unit"
    )
    
    load_desc_options = [
        "Heating or Lighting (Resistive)",
        "Motor or Compressor / Non-Inverter (Inductive)",
        "Modern \"Energy Saver\" / Inverter (Inverter)",
        "IT & Server Gear / Computer (Sensitive)",
        "High-Precision CNC/Medical (Hyper-Sensitive)"
    ]
    load_desc = st.selectbox("Load Characteristic", load_desc_options)
    
    # Extract load_key from description
    load_key = "Resistive" if "Resistive" in load_desc else \
               ("Inductive" if "Inductive" in load_desc else \
               ("Inverter" if "Inverter" in load_desc else \
               ("Sensitive" if "Sensitive" in load_desc else "Hyper-Sensitive")))
               
    unit_type_col, unit_scale_col = st.columns(2)
    with unit_type_col:
        unit_toggle = st.radio("Input Unit", ["Power (W/kW)", "Amps"], horizontal=True)
    
    with unit_scale_col:
        is_power = "Power" in unit_toggle
        if is_power:
            power_unit = st.radio("Scale", ["kW", "Watts"], horizontal=True)
        else:
            st.markdown("<br><p style='color: #64748B; font-weight: bold;'>Scale Locked</p>", unsafe_allow_html=True)

    rating_val = st.number_input("Rating Value", min_value=0.0, step=0.1, value=0.0)
    voltage_label = st.selectbox("Voltage Profile", list(VOLTAGES.keys()))
    v_cfg = VOLTAGES[voltage_label]
    
    st.markdown('</div>', unsafe_allow_html=True)

# Calculation Logic (Matching HTML exactly)
with col_result:
    if rating_val > 0:
        cfg = v_cfg
        phase_factor = 1.732 if cfg["phase"] == 3 else 1.0
        base_kva = 0
        
        if is_power:
            kw = (rating_val / 1000.0) if power_unit == "Watts" else rating_val
            base_kva = kw / 0.8 # Standard PF assumption for calculation
        else:
            base_kva = (rating_val * cfg["volt"] * phase_factor) / 1000.0
            
        multiplier = MULTIPLIERS[load_key]
        calc_kva = base_kva * multiplier
        floor_kva = base_kva * cfg["buffer"]
        rec_kva = max(calc_kva, floor_kva)
        
        # HTML Rounding Rules
        final_kva = 0
        if rec_kva <= 15:
            final_kva = float(math.ceil(rec_kva))
        elif rec_kva <= 100:
            final_kva = float(math.ceil(rec_kva / 10.0) * 10)
        elif rec_kva <= 120:
            final_kva = 120.0
        elif rec_kva <= 150:
            final_kva = 150.0
        elif rec_kva <= 200:
            final_kva = 200.0
        else:
            final_kva = float(math.ceil(rec_kva / 50.0) * 50)
            
        # UI Logic
        error_msg = ""
        # 1. Single Phase 60kVA Ceiling
        if cfg["phase"] == 1 and final_kva > 60:
            error_msg = f"A requirement of <strong>{final_kva:g}kVA</strong> is too big for Single Phase (1P 220V) hardware. Seek professional advice, request a quote or assistance from us below."
        
        # 2. 3-Phase Minimum Check
        elif cfg["phase"] == 3 and final_kva < 10:
            error_msg = "Standard 3-Phase systems require a minimum 10kVA configuration. For smaller loads, please verify your equipment wiring or contact Kinmo Engineers."

        if error_msg:
            st.markdown(f"""
            <div class="error-box">
                <h2 style="font-weight: 900; margin-bottom: 1rem; text-transform: uppercase;">Load Capacity Warning</h2>
                <p style="font-size: 1.1rem; line-height: 1.6;">{error_msg}</p>
            </div>
            """, unsafe_allow_html=True)
            
            spec_text = f"LOAD TOO LARGE: {final_kva:g}kVA {voltage_label} for {appliance_name if appliance_name else 'Equipment'}"
            msg_url = f"https://m.me/kinmopw?text=Hello! I used your Pro-Sizing Tool and it says my load is too large for standard 1P setup: {spec_text}"
            st.markdown(f'<a href="{msg_url}" class="btn-quote" target="_blank">Contact Engineering</a>', unsafe_allow_html=True)
            
        else:
            # Success View
            spec_text = f"{final_kva:g}kVA {voltage_label} for {appliance_name if appliance_name else 'Equipment'} ({load_key})"
            msg_url = f"https://m.me/kinmopw?text=Hello! I used your Pro-Sizing Tool and need a professional quote for: {spec_text}"
            
            # Image Logic
            images_html = ""
            hyper_sensitive_advisory = ""

            if load_key == "Hyper-Sensitive":
                hyper_sensitive_advisory = f"""
                <div style="margin-top: 1.5rem; padding: 1.25rem; background: #EFF6FF; border: 2px solid #BFDBFE; border-radius: 1.5rem; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span style="background: #2563EB; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900;">!</span>
                        <p style="font-size: 0.7rem; font-weight: 900; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">Precision Load Advisory</p>
                    </div>
                    <p style="font-size: 0.8rem; font-weight: 700; color: #1E40AF; line-height: 1.5; margin: 0;">
                        For Hyper-Sensitive machines, we strongly recommend using an <strong>Active Voltage Conditioner</strong> or <strong>Static Voltage Regulator</strong> for nanosecond correction speeds. Please send an inquiry for more information.
                    </p>
                </div>
                """

            if final_kva < 10:
                images_html = f"""
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <img src="{avr1_b64}" class="product-img" style="height: 120px;">
                    <img src="{avr2_b64}" class="product-img" style="height: 120px;">
                    <img src="{avr3_b64}" class="product-img" style="height: 120px;">
                </div>"""
            elif final_kva <= 60:
                images_html = f"""
                <div style="text-align: center;">
                    <img src="{avr_vertical_b64}" class="product-img" style="height: 180px;">
                    <p style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase; margin-top: 10px;">NSR Series Industrial Cabinet</p>
                </div>"""
            elif final_kva <= 500:
                images_html = f"""
                <div style="text-align: center;">
                    <img src="{avr_vertical_b64 if not avr_cabinet_b64 else avr_cabinet_b64}" class="product-img" style="height: 180px;">
                    <p style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase; margin-top: 10px;">High-Capacity Precision System</p>
                </div>"""
            else:
                images_html = f"""
                <div style="text-align: center;">
                    <img src="{avr_huge_b64}" class="product-img" style="height: 180px;">
                    <p style="font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase; margin-top: 10px;">Utility Grade MVA Protection</p>
                </div>"""

            st.markdown(f"""
            <div class="result-card">
                <span style="font-size: 0.9rem; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.2em;">Recommended Capacity</span>
                <div class="value-display">{final_kva:g} <span style="font-size: 2.5rem; font-weight: 800;">kVA</span></div>
                
                <div class="product-display">
                    <p style="text-align: left; font-size: 0.65rem; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem;">Recommended Unit Profile</p>
                    {images_html}
                </div>
                
                {hyper_sensitive_advisory}

                <a href="{msg_url}" class="btn-quote" target="_blank">Request a Quote From Kinmo</a>
                
                <div style="margin-top: 1.5rem; padding: 1.5rem; background: #F1F5F9; border-radius: 1.5rem; text-align: left; border: 1px solid #E2E8F0;">
                    <p style="font-size: 0.75rem; color: #64748B; font-weight: 600; line-height: 1.6; font-style: italic;">
                        <strong>Official Note:</strong> This sizing is an engineering estimate based on standard load curves. To finalize your specifications and ensure power quality accuracy, please schedule an ocular inspection.
                    </p>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
    else:
        # Empty State
        st.markdown(f"""
        <div style="display: flex; flex-direction: column; items-center; justify-content: center; padding: 3rem; background: #F1F5F9; border-radius: 2.5rem; border: 4px dashed #E2E8F0; text-align: center; height: 100%;">
            <img src="data:image/png;base64,{base64.b64encode(open(os.path.join(SCRIPT_DIR, 'logo.png'), 'rb').read()).decode() if os.path.exists(os.path.join(SCRIPT_DIR, 'logo.png')) else ''}" style="width: 120px; opacity: 0.2; margin: 0 auto 2rem; filter: grayscale(1);">
            <p style="color: #94A3B8; font-weight: 700; font-size: 1.25rem; max-width: 300px; margin: 0 auto; line-height: 1.4;">Complete the parameters to generate your professional recommendation. Please send an inquiry for more information.</p>
        </div>
        """, unsafe_allow_html=True)

# Footer
st.markdown("""
<div style="text-align: center; border-top: 1px solid #E2E8F0; margin-top: 4rem; padding-top: 2rem; color: #64748B; padding-bottom: 4rem;">
    <p style="font-weight: 800; font-size: 1rem; color: #002B5B; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;">Kinmo PW Corporation</p>
    <p style="font-size: 0.9rem; font-weight: 500;">Expert Engineering | Rapid Response | Power Quality Solutions</p>
</div>
""", unsafe_allow_html=True)

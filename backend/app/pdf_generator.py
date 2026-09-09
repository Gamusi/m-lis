import os
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether, Paragraph
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from . import evaluator

from reportlab.pdfgen import canvas

PAGE_WIDTH, PAGE_HEIGHT = A4
SAFE_MARGIN_X = 56.69
SAFE_WINDOW_Y = 600.95

FONT_REGULAR = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
FONT_SYMBOL = 'Helvetica'

class ReportNumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas for dynamic total page count and professional 'Page X of Y' rendering.
    Draws letterhead background (single-page full letterhead or multi-page header/watermark/footer)
    and page numbering dynamically across pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.letterhead_override = None

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        branding_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "assets", "branding")
        )
        full_path = self.letterhead_override or os.path.join(branding_dir, "letterhead.png")
        header_path = os.path.join(branding_dir, "letterhead-header+watermark_only.png")
        watermark_path = os.path.join(branding_dir, "letterhead-watermark_only.png")
        footer_path = os.path.join(branding_dir, "letterhead-footer+watermark_only.png")

        for state in self._saved_page_states:
            self.__dict__.update(state)
            page_num = self._pageNumber

            # 1. Background image selection
            if num_pages == 1 or self.letterhead_override:
                bg_img = full_path
            elif page_num == 1:
                bg_img = header_path if os.path.exists(header_path) else full_path
            elif page_num == num_pages:
                bg_img = footer_path if os.path.exists(footer_path) else watermark_path
            else:
                bg_img = watermark_path if os.path.exists(watermark_path) else full_path

            if os.path.exists(bg_img):
                self.saveState()
                self.drawImage(bg_img, 0, 0, width=PAGE_WIDTH, height=PAGE_HEIGHT, mask='auto')
                self.restoreState()

            # 2. Dynamic footer page numbering (bottom right, cleanly above footer margin)
            self.saveState()
            self.setFont(FONT_REGULAR, 7.5)
            self.setFillColor(colors.HexColor('#64748B'))
            self.drawRightString(PAGE_WIDTH - SAFE_MARGIN_X, 52, f"Page {page_num} of {num_pages}")
            self.restoreState()

            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

def _init_fonts():
    global FONT_REGULAR, FONT_BOLD, FONT_SYMBOL
    fonts_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
    )
    segoe_path = os.path.join(fonts_dir, "segoeui.ttf")
    segoe_bold_path = os.path.join(fonts_dir, "segoeuib.ttf")
    symbol_path = os.path.join(fonts_dir, "seguisym.ttf")
    
    if not os.path.exists(symbol_path) and os.path.exists(r"C:\Windows\Fonts\seguisym.ttf"):
        symbol_path = r"C:\Windows\Fonts\seguisym.ttf"
    if not os.path.exists(segoe_path) and os.path.exists(r"C:\Windows\Fonts\segoeui.ttf"):
        segoe_path = r"C:\Windows\Fonts\segoeui.ttf"
    if not os.path.exists(segoe_bold_path) and os.path.exists(r"C:\Windows\Fonts\segoeuib.ttf"):
        segoe_bold_path = r"C:\Windows\Fonts\segoeuib.ttf"
        
    try:
        if os.path.exists(symbol_path):
            pdfmetrics.registerFont(TTFont('SegoeUISymbol', symbol_path))
            FONT_SYMBOL = 'SegoeUISymbol'
        if os.path.exists(segoe_path):
            pdfmetrics.registerFont(TTFont('SegoeUI', segoe_path))
            FONT_REGULAR = 'SegoeUI'
        if os.path.exists(segoe_bold_path):
            pdfmetrics.registerFont(TTFont('SegoeUIBold', segoe_bold_path))
            FONT_BOLD = 'SegoeUIBold'
    except Exception:
        pass

_init_fonts()

def _draw_background_hook(canvas, doc, letterhead_override=None):
    canvas.saveState()
    letterhead_path = letterhead_override or os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "assets", "branding", "letterhead.png")
    )
    if os.path.exists(letterhead_path):
        canvas.drawImage(letterhead_path, 0, 0, width=PAGE_WIDTH, height=PAGE_HEIGHT, mask='auto')
    canvas.restoreState()

def _build_metadata_table(order_data: dict) -> Table:
    lab_no = order_data.get("lab_number") or order_data.get("client_number", "")
    requested_by = order_data.get("requested_by") or order_data.get("ordered_by", "")
    date_val = order_data.get("ordered_date") or order_data.get("date", "")
    ward = order_data.get("ward_of_origin", "")
    specimen = str(order_data.get("specimen") or "")

    lbl_style = ParagraphStyle(name="MetaLbl", fontName=FONT_BOLD, fontSize=8.5, leading=10.5)
    val_style = ParagraphStyle(name="MetaVal", fontName=FONT_REGULAR, fontSize=8.5, leading=10.5)

    data = [
        [Paragraph("Client Name:", lbl_style), Paragraph(str(order_data.get("full_name") or ""), val_style), Paragraph("Lab No:", lbl_style), Paragraph(str(lab_no), val_style)],
        [Paragraph("Age:", lbl_style), Paragraph(str(order_data.get("age") or ""), val_style), Paragraph("Sex:", lbl_style), Paragraph(str(order_data.get("sex") or ""), val_style)],
        [Paragraph("Requested by:", lbl_style), Paragraph(str(requested_by), val_style), Paragraph("Date:", lbl_style), Paragraph(str(date_val), val_style)],
        [Paragraph("Ward / OPD:", lbl_style), Paragraph(str(ward), val_style), Paragraph("Specimen (s):", lbl_style), Paragraph(str(specimen), val_style)]
    ]
    
    t = Table(data, colWidths=[90, 150, 85, 155])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 1),
        ('RIGHTPADDING', (0,0), (-1,-1), 1),
    ]))
    return t

def _build_department_table(dept_name: str, tests: list, compact: bool = False) -> KeepTogether:
    # 5-column layout: Test (150), Result (75), Unit (60), Flag (55), Reference (140) = 480 pt total
    data = []
    
    internal_categories = ["Main", "Referrals", "Out-Reaches"]
    show_dept = dept_name not in internal_categories
    
    dept_title_style = ParagraphStyle(name="DeptTitleStyle", fontName=FONT_BOLD, fontSize=9, leading=11)
    tbl_header_style = ParagraphStyle(name="TblHeaderStyle", fontName=FONT_BOLD, fontSize=8.5, leading=10.5)
    panel_title_style = ParagraphStyle(name="PanelTitleStyle", fontName=FONT_BOLD, fontSize=8.5, leading=10.5)
    test_title_style = ParagraphStyle(name="TestTitleStyle", fontName=FONT_REGULAR, fontSize=8.5, leading=10.5)
    param_title_style = ParagraphStyle(name="ParamTitleStyle", fontName=FONT_REGULAR, fontSize=8.5, leading=10.5, leftIndent=8)
    unit_style = ParagraphStyle(name="UnitStyle", fontName=FONT_REGULAR, fontSize=8, leading=10)
    ref_style = ParagraphStyle(name="RefStyle", fontName=FONT_REGULAR, fontSize=8, leading=10)
    result_style = ParagraphStyle(name="ResultStyle", fontName=FONT_REGULAR, fontSize=8.5, leading=10.5)
    result_abnormal_style = ParagraphStyle(name="ResultAbnormalStyle", fontName=FONT_BOLD, fontSize=8.5, leading=10.5, textColor=colors.HexColor('#dc2626'))
    flag_center_style = ParagraphStyle(name="FlagCenterStyle", fontName=FONT_BOLD, fontSize=8.5, leading=10.5, alignment=TA_CENTER)
    
    # Determine if this department uses Units and Reference ranges
    has_any_units = False
    has_any_refs = False

    for t in tests:
        params = t.get("parameters")
        if params and len(params) > 0:
            for p in params:
                if str(p.get("unit") or "").strip():
                    has_any_units = True
                if str(p.get("reference_range") or p.get("reference") or "").strip():
                    has_any_refs = True
        else:
            if str(t.get("unit") or "").strip():
                has_any_units = True
            if str(t.get("reference") or t.get("reference_range") or "").strip():
                has_any_refs = True

    # Column configuration:
    # Full (Group I): Test(150), Result(75), Unit(60), Flag(55), Reference(140) = 480 pt
    # No Units, Has Ref (Group III): Test(180), Result(110), Flag(50), Reference(140) = 480 pt
    # No Units, No Ref (Group II): Test(250), Result(180), Flag(50) = 480 pt
    # Has Units, No Ref: Test(200), Result(120), Unit(100), Flag(60) = 480 pt

    if has_any_units and has_any_refs:
        layout_mode = 'FULL' # Group I
        col_widths = [150, 75, 60, 55, 140]
        headers = ["Test", "Result", "Unit", "Flag", "Reference"]
    elif not has_any_units and has_any_refs:
        layout_mode = 'NO_UNIT' # Group III (Semi-quantitative / Titers)
        col_widths = [180, 110, 50, 140]
        headers = ["Test", "Result", "Flag", "Reference / Cutoff"]
    elif not has_any_units and not has_any_refs:
        layout_mode = 'QUALITATIVE' # Group II (Descriptive / Qualitative)
        col_widths = [250, 180, 50]
        headers = ["Test", "Result", "Flag"]
    else:
        layout_mode = 'NO_REF'
        col_widths = [200, 120, 100, 60]
        headers = ["Test", "Result", "Unit", "Flag"]

    num_cols = len(col_widths)

    if show_dept:
        dept_row = [Paragraph(dept_name, dept_title_style)] + [""] * (num_cols - 1)
        data.append(dept_row)
        
    data.append([Paragraph(h, tbl_header_style) for h in headers])
    
    row_pad = 2.0 if compact else 3.5
    flag_col_idx = 3 if layout_mode == 'FULL' else (2 if layout_mode in ('NO_UNIT', 'QUALITATIVE') else 3)
    style_cmds = [
        ('FONTNAME', (0,0), (-1,-1), FONT_REGULAR),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e0e0')),
        ('TOPPADDING', (0,0), (-1,-1), row_pad),
        ('BOTTOMPADDING', (0,0), (-1,-1), row_pad),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (flag_col_idx, 0), (flag_col_idx, -1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]

    for t in tests:
        params = t.get("parameters")
        if params and len(params) > 0:
            panel_name = str(t.get("test_name") or "")

            if "hiv" in panel_name.lower():
                def _hiv_sort_key(p):
                    pname = str(p.get("name") or p.get("parameter_name") or "").lower()
                    if any(k in pname for k in ("oraquick", "self-test", "hivst")):
                        return 1
                    if any(k in pname for k in ("kwiq", "determine")):
                        return 2
                    if any(k in pname for k in ("stat-pak", "statpak")):
                        return 3
                    if any(k in pname for k in ("bioline", "uni-gold")):
                        return 4
                    return p.get("sort_order") if p.get("sort_order") is not None else 99
                # Filter out EID tests from HIV rapid algorithm panel (they are reported independently)
                display_params = [p for p in params if not any(x in str(p.get("name") or p.get("parameter_name") or "").lower() for x in ("eid", "pcr"))]
                display_params = sorted(display_params, key=_hiv_sort_key)
            else:
                display_params = sorted(params, key=lambda p: (p.get("sort_order") if p.get("sort_order") is not None else 999))

            # Filter out parameters with empty or null results
            display_params = [
                p for p in display_params
                if str(p.get("result") if p.get("result") is not None else p.get("result_value", "")).strip() not in ("", "None")
            ]

            # If no parameters have results, skip rendering this panel entirely
            if not display_params:
                continue

            # Render Panel Subheader
            panel_row = [Paragraph(panel_name, panel_title_style)] + [""] * (num_cols - 1)
            data.append(panel_row)
            panel_row_idx = len(data) - 1
            style_cmds.append(('BACKGROUND', (0, panel_row_idx), (-1, panel_row_idx), colors.HexColor('#f8fafc')))
            style_cmds.append(('SPAN', (0, panel_row_idx), (-1, panel_row_idx)))

            for p in display_params:
                p_name = str(p.get("name") or p.get("parameter_name") or "")
                p_res = str(p.get("result") if p.get("result") is not None else p.get("result_value", ""))
                p_unit = str(p.get("unit") or "")
                p_ref = str(p.get("reference_range") or p.get("reference") or "")
                p_flag = str(p.get("flag") or "")

                if not p_flag and evaluator.is_qualitative_abnormal(p_res, p_ref, param_name=p_name):
                    p_flag = "\u26A0"
                if p_flag == "[!]":
                    p_flag = "\u26A0"

                if p_flag == "\u26A0":
                    if FONT_SYMBOL != 'Helvetica':
                        flag_cell = Paragraph(f'<font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', flag_center_style)
                    else:
                        flag_cell = Paragraph('<font color="#dc2626"><b>\u26A0</b></font>', flag_center_style)
                elif p_flag:
                    flag_cell = Paragraph(f'<font color="#dc2626">{p_flag}</font>', flag_center_style)
                else:
                    flag_cell = ""

                is_abnormal = p_flag in ["High", "Low", "Abnormal", "Reactive", "Positive", "H", "L", "H*", "L*", "*", "\u26A0", "[!]"] or evaluator.is_qualitative_abnormal(p_res, p_ref, param_name=p_name)
                res_para = Paragraph(p_res, result_abnormal_style if is_abnormal else result_style) if p_res else ""
                
                if layout_mode == 'FULL':
                    data.append([
                        Paragraph(p_name, param_title_style),
                        res_para,
                        Paragraph(p_unit, unit_style) if p_unit else "",
                        flag_cell,
                        Paragraph(p_ref, ref_style) if p_ref else ""
                    ])
                elif layout_mode == 'NO_UNIT':
                    data.append([
                        Paragraph(p_name, param_title_style),
                        res_para,
                        flag_cell,
                        Paragraph(p_ref, ref_style) if p_ref else ""
                    ])
                elif layout_mode == 'QUALITATIVE':
                    data.append([
                        Paragraph(p_name, param_title_style),
                        res_para,
                        flag_cell
                    ])
                else:
                    data.append([
                        Paragraph(p_name, param_title_style),
                        res_para,
                        Paragraph(p_unit, unit_style) if p_unit else "",
                        flag_cell
                    ])

            if "hiv" in panel_name.lower() and display_params:
                hiv_derived = evaluator.derive_hiv_outcome(display_params)
                h_flag = hiv_derived.get("clinical_flag")
                if h_flag:
                    if FONT_SYMBOL != 'Helvetica':
                        h_flag_cell = Paragraph(f'<font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', flag_center_style)
                    else:
                        h_flag_cell = Paragraph('<font color="#dc2626"><b>\u26A0</b></font>', flag_center_style)
                else:
                    h_flag_cell = ""

                h_res_para = Paragraph(f"<b>{hiv_derived['display_result']}</b>", result_abnormal_style if h_flag else result_style)
                if layout_mode == 'FULL':
                    data.append([
                        Paragraph("<b>Final HIV Interpretation:</b>", param_title_style),
                        h_res_para,
                        Paragraph("", unit_style),
                        h_flag_cell,
                        Paragraph(hiv_derived.get("reference") or "Negative", ref_style)
                    ])
                elif layout_mode == 'NO_UNIT':
                    data.append([
                        Paragraph("<b>Final HIV Interpretation:</b>", param_title_style),
                        h_res_para,
                        h_flag_cell,
                        Paragraph(hiv_derived.get("reference") or "Negative", ref_style)
                    ])
                else:
                    data.append([
                        Paragraph("<b>Final HIV Interpretation:</b>", param_title_style),
                        h_res_para,
                        h_flag_cell
                    ])
                summary_row_idx = len(data) - 1
                style_cmds.append(('BACKGROUND', (0, summary_row_idx), (-1, summary_row_idx), colors.HexColor('#f1f5f9')))


                if hiv_derived.get("advisory"):
                    adv_row_idx = len(data)
                    adv_style = ParagraphStyle(
                        name=f"HivAdv_{adv_row_idx}",
                        fontName=FONT_REGULAR,
                        fontSize=7.5,
                        leading=9.5,
                        textColor=colors.HexColor('#334155'),
                        leftIndent=8
                    )
                    adv_row = [Paragraph(f"<i>Clinical Note: {hiv_derived['advisory']}</i>", adv_style)] + [""] * (num_cols - 1)
                    data.append(adv_row)
                    style_cmds.append(('SPAN', (0, adv_row_idx), (-1, adv_row_idx)))
                    style_cmds.append(('BACKGROUND', (0, adv_row_idx), (-1, adv_row_idx), colors.HexColor('#f8fafc')))

            clin_comm = t.get("clinical_comments")
            if clin_comm and "hiv" not in panel_name.lower():
                comm_row_idx = len(data)
                comm_style = ParagraphStyle(
                    name=f"ClinComm_{comm_row_idx}",
                    fontName=FONT_REGULAR,
                    fontSize=7,
                    leading=8.5,
                    textColor=colors.HexColor('#475569'),
                    leftIndent=8
                )
                comm_row = [Paragraph(f"<i><b>Clinical Note:</b> {clin_comm}</i>", comm_style)] + [""] * (num_cols - 1)
                data.append(comm_row)
                style_cmds.append(('SPAN', (0, comm_row_idx), (-1, comm_row_idx)))
            if len(data) - 1 >= panel_row_idx:
                style_cmds.append(('NOSPLIT', (0, panel_row_idx), (-1, len(data) - 1)))
        else:
            # Standalone single test
            test_row_start = len(data)
            res_text = str(t.get("result") or "")
            flag_text = str(t.get("flag") or "")
            t_name = str(t.get("test_name") or "")
            t_unit = str(t.get("unit") or "")
            t_ref = str(t.get("reference") or t.get("reference_range") or "")

            # Suppress unit and reference columns for semi-quantitative CD4 RDT
            t_low = t_name.lower()
            if ("rapid test strip" in t_low or "cd4_rdt" in t_low or ("cd4" in t_low and "rdt" in t_low)):
                t_unit = ""
                t_ref = ""

            if ("cd4" in t_low or "visitect" in t_low) and "below 200" in res_text.lower():
                flag_text = "L*"

            if not flag_text and evaluator.is_qualitative_abnormal(res_text, t_ref, param_name=t_name):
                flag_text = "\u26A0"
            if flag_text == "[!]":
                flag_text = "\u26A0"

            if flag_text == "\u26A0":
                if FONT_SYMBOL != 'Helvetica':
                    flag_cell = Paragraph(f'<font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', flag_center_style)
                else:
                    flag_cell = Paragraph('<font color="#dc2626"><b>\u26A0</b></font>', flag_center_style)
            elif flag_text:
                flag_cell = Paragraph(f'<font color="#dc2626">{flag_text}</font>', flag_center_style)
            else:
                flag_cell = ""

            is_abnormal = flag_text in ["High", "Low", "Abnormal", "Reactive", "Positive", "H", "L", "H*", "L*", "*", "\u26A0", "[!]"] or evaluator.is_qualitative_abnormal(res_text, t_ref, param_name=t_name)
            res_para = Paragraph(res_text, result_abnormal_style if is_abnormal else result_style) if res_text else ""

            if layout_mode == 'FULL':
                data.append([
                    Paragraph(t_name, test_title_style),
                    res_para,
                    Paragraph(t_unit, unit_style) if t_unit else "",
                    flag_cell,
                    Paragraph(t_ref, ref_style) if t_ref else ""
                ])
            elif layout_mode == 'NO_UNIT':
                data.append([
                    Paragraph(t_name, test_title_style),
                    res_para,
                    flag_cell,
                    Paragraph(t_ref, ref_style) if t_ref else ""
                ])
            elif layout_mode == 'QUALITATIVE':
                data.append([
                    Paragraph(t_name, test_title_style),
                    res_para,
                    flag_cell
                ])
            else:
                data.append([
                    Paragraph(t_name, test_title_style),
                    res_para,
                    Paragraph(t_unit, unit_style) if t_unit else "",
                    flag_cell
                ])

            # CD4 clinical decision support row
            if ("cd4" in t_low or "visitect" in t_low) and res_text:
                cd4_eval = evaluator.evaluate_cd4_interpretation(t_name, res_text)
                comm_text = cd4_eval.get("interpretive_comment")
                if comm_text:
                    comm_row_idx = len(data)
                    is_ahd = cd4_eval.get("is_ahd", False)
                    comm_style = ParagraphStyle(
                        name=f"CD4Note_{comm_row_idx}",
                        fontName=FONT_BOLD if is_ahd else FONT_REGULAR,
                        fontSize=6.5 if compact else 7,
                        leading=8.5 if compact else 9,
                        textColor=colors.HexColor('#991b1b') if is_ahd else colors.HexColor('#475569'),
                        leftIndent=6,
                        rightIndent=6
                    )
                    prefix = "<b>CRITICAL ALERT:</b> " if is_ahd else "<i><b>Clinical Note:</b> </i>"
                    clean_note = comm_text
                    if clean_note.startswith("CRITICAL ALERT:"):
                        clean_note = clean_note[len("CRITICAL ALERT:"):].strip()
                    note_para = Paragraph(f"{prefix}{clean_note}", comm_style)
                    comm_row = [note_para] + [""] * (num_cols - 1)
                    data.append(comm_row)
                    style_cmds.append(('SPAN', (0, comm_row_idx), (-1, comm_row_idx)))
                    style_cmds.append(('BACKGROUND', (0, comm_row_idx), (-1, comm_row_idx), colors.HexColor('#fef2f2') if is_ahd else colors.HexColor('#f8fafc')))
                    if is_ahd:
                        style_cmds.append(('BOX', (0, comm_row_idx), (-1, comm_row_idx), 0.5, colors.HexColor('#fca5a5')))
            if len(data) - 1 >= test_row_start:
                style_cmds.append(('NOSPLIT', (0, test_row_start), (-1, len(data) - 1)))
        
    num_repeat_rows = 2 if show_dept else 1
    t_elem = Table(data, colWidths=col_widths, repeatRows=num_repeat_rows)
    
    header_row_idx = 1 if show_dept else 0
    if show_dept:
        style_cmds.append(('FONTNAME', (0,0), (-1,0), FONT_BOLD))
        style_cmds.append(('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f0f0f0')))
        style_cmds.append(('SPAN', (0,0), (-1,0)))
        
    style_cmds.append(('FONTNAME', (0, header_row_idx), (-1, header_row_idx), FONT_BOLD))
    style_cmds.append(('LINEBELOW', (0, header_row_idx), (-1, header_row_idx), 1, colors.black))
    
    t_elem.setStyle(TableStyle(style_cmds))
    
    return t_elem

def _build_signatures_table(order_data: dict, compact: bool = False) -> KeepTogether:
    tech = str(order_data.get("technician_name") or "").strip()
    verified = str(order_data.get("verified_by") or "").strip()
    
    done_str = f"Done by: {tech} _______________" if tech else "Done by: _______________"
    verified_str = f"Verified by: {verified} _______________" if verified else "Verified by: _______________"
    
    data = [
        [done_str, verified_str]
    ]
    
    t = Table(data, colWidths=[240, 240])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_BOLD),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    spacer_h = 6 if compact else 12
    return KeepTogether([Spacer(1, spacer_h), t])


def _clean_urinalysis_name(name: str) -> str:
    name_str = str(name).strip()
    name_lower = name_str.lower()
    if "pus cell" in name_lower and "/ lpf" not in name_lower:
        return "Pus Cells (/ lpf)"
    if "red blood cell" in name_lower and "/ lpf" not in name_lower:
        return "Red Blood Cells (/ lpf)"
    if "epithelial" in name_lower and "/ lpf" not in name_lower:
        return "Epithelial Cells (/ lpf)"
    if name_lower == "casts" or name_lower == "casts (/ lpf)":
        return "Casts (/ lpf)"
    if "(" in name_str and ")" in name_str:
        base = name_str.split("(")[0].strip()
        if base.lower() in ["proteins", "glucose", "bilirubin", "ketones", "blood", "nitrates", "nitrate", "leukocytes", "leukocyte esterase"]:
            if base.lower() in ["nitrates", "nitrate"]:
                return "Nitrate"
            if base.lower() in ["leukocytes", "leukocyte esterase"]:
                return "Leukocyte Esterase"
            return base
    return name_str


def _build_urinalysis_table(urinalysis_test: dict, compact: bool = False) -> KeepTogether:
    items = []
    ua_p_style = ParagraphStyle(name="UaParaStyle", fontName=FONT_REGULAR, fontSize=7.5, leading=9)
    
    if urinalysis_test.get("parameters"):
        sorted_params = sorted(
            urinalysis_test["parameters"],
            key=lambda p: (p.get("sort_order") if p.get("sort_order") is not None else 999)
        )
        for p in sorted_params:
            pname = _clean_urinalysis_name(p.get("name") or p.get("parameter_name") or "")
            pres = p.get("result") if p.get("result") is not None else p.get("result_value", "")
            
            pflag = p.get("flag") or ("\u26A0" if p.get("is_positive") else "")
            if not pflag and evaluator.is_qualitative_abnormal(str(pres), param_name=pname):
                pflag = "\u26A0"
            if pflag == "[!]":
                pflag = "\u26A0"

            if pflag == "\u26A0":
                if FONT_SYMBOL != 'Helvetica':
                    pres_cell = Paragraph(f'{pres} <font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', ua_p_style)
                else:
                    pres_cell = Paragraph(f'{pres} <font color="#dc2626"><b>\u26A0</b></font>', ua_p_style)
            else:
                pres_cell = str(pres)

            items.append((str(pname), pres_cell))
    else:
        result_str = str(urinalysis_test.get("result") or "")
        import json
        raw_items = []
        try:
            parsed = json.loads(result_str)
            if isinstance(parsed, dict):
                for k, v in parsed.items():
                    raw_items.append((str(k), str(v)))
            elif isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        raw_items.append((str(item.get("name", "")), str(item.get("result", ""))))
            else:
                raw_items.append(("Result", result_str))
        except Exception:
            if "\n" in result_str:
                lines = result_str.split("\n")
                for line in lines:
                    if ":" in line:
                        k, v = line.split(":", 1)
                        raw_items.append((k.strip(), v.strip()))
                    else:
                        raw_items.append(("", line.strip()))
            elif "," in result_str and ":" in result_str:
                parts = result_str.split(",")
                for p in parts:
                    if ":" in p:
                        k, v = p.split(":", 1)
                        raw_items.append((k.strip(), v.strip()))
            else:
                raw_items.append(("Result", result_str))

        for k, v in raw_items:
            clean_k = _clean_urinalysis_name(k)
            flag = "\u26A0" if evaluator.is_qualitative_abnormal(str(v), param_name=clean_k) else ""
            if flag == "\u26A0":
                if FONT_SYMBOL != 'Helvetica':
                    v_cell = Paragraph(f'{v} <font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', ua_p_style)
                else:
                    v_cell = Paragraph(f'{v} <font color="#dc2626"><b>\u26A0</b></font>', ua_p_style)
            else:
                v_cell = str(v)
            items.append((str(clean_k), v_cell))

    if not items:
        items = [("Result", str(urinalysis_test.get("result") or ""))]

    n = len(items)
    half = (n + 1) // 2
    col1 = items[:half]
    col2 = items[half:]

    data = [
        ["Urinalysis", "", "", ""],
        ["Parameter", "Result", "Parameter", "Result"]
    ]

    for i in range(half):
        p1, r1 = col1[i]
        p2, r2 = col2[i] if i < len(col2) else ("", "")
        data.append([p1, r1, p2, r2])

    t = Table(data, colWidths=[145, 95, 145, 95])
    row_pad = 1.5 if compact else 2.0
    t.setStyle(TableStyle([
        ('SPAN', (0,0), (3,0)),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f0f0f0')),
        ('FONTSIZE', (0,0), (-1,0), 8.5),
        ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,1), 8),
        ('LINEBELOW', (0,1), (-1,1), 0.8, colors.black),
        ('FONTNAME', (0,2), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,2), (-1,-1), 7.5),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), row_pad),
        ('TOPPADDING', (0,0), (-1,-1), row_pad),
        ('GRID', (0,1), (-1,-1), 0.3, colors.HexColor('#d0d0d0')),
    ]))
    return KeepTogether([t, Spacer(1, 4 if compact else 10)])

def generate_blood_bag_label(label_data: dict) -> bytes:
    buffer = io.BytesIO()
    label_width = 283.46
    label_height = 212.60
    margin = 8.0

    doc = SimpleDocTemplate(
        buffer,
        pagesize=(label_width, label_height),
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )

    h_bold = 'Helvetica-Bold'
    h_reg = 'Helvetica'

    client_name = str(label_data.get("client_name") or "").upper()
    lab_no = str(label_data.get("lab_number") or label_data.get("client_number") or "")
    ward = str(label_data.get("ward") or "OPD")
    client_group = str(label_data.get("client_blood_group") or "")

    donor_id = str(label_data.get("donor_unit_id") or "")
    donor_group = str(label_data.get("donor_blood_group") or "")
    product = str(label_data.get("product_type") or "PRBC")
    exp_date = str(label_data.get("expiry_date") or "")

    tech = str(label_data.get("technician_name") or "")
    verifier = str(label_data.get("verified_by") or "")
    issued_at = str(label_data.get("issued_at") or "")

    flowables = []

    header_style = ParagraphStyle(name="LblHdr", fontName=h_bold, fontSize=8, leading=9.5, alignment=TA_CENTER, textColor=colors.HexColor('#0f172a'))
    flowables.append(Paragraph("M-LIS BLOOD TRANSFUSION SERVICE", header_style))
    flowables.append(Spacer(1, 2))

    banner_data = [[Paragraph("RELEASED FOR INFUSION", ParagraphStyle(name="Banner", fontName=h_bold, fontSize=9.5, leading=11, alignment=TA_CENTER, textColor=colors.white))]]
    banner_tbl = Table(banner_data, colWidths=[label_width - 2 * margin])
    banner_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#15803d')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    flowables.append(banner_tbl)
    flowables.append(Spacer(1, 3))

    cell_style = ParagraphStyle(name="LblCell", fontName=h_reg, fontSize=7, leading=8.5)
    bold_cell_style = ParagraphStyle(name="LblBoldCell", fontName=h_bold, fontSize=7, leading=8.5)

    info_data = [
        [Paragraph("Client Name:", bold_cell_style), Paragraph(client_name, bold_cell_style), Paragraph("Lab No:", bold_cell_style), Paragraph(lab_no, bold_cell_style)],
        [Paragraph("Client ABO/Rh:", bold_cell_style), Paragraph(client_group, cell_style), Paragraph("Ward / OPD:", bold_cell_style), Paragraph(ward, cell_style)],
        [Paragraph("Donor Unit ID:", bold_cell_style), Paragraph(f"<b>{donor_id}</b>", bold_cell_style), Paragraph("Donor Group:", bold_cell_style), Paragraph(f"<b>{donor_group}</b>", bold_cell_style)],
        [Paragraph("Product Type:", bold_cell_style), Paragraph(product, cell_style), Paragraph("Unit Expiry:", bold_cell_style), Paragraph(exp_date, bold_cell_style)],
        [Paragraph("Cross-match:", bold_cell_style), Paragraph("<b>FULL 3-PHASE COMPATIBLE</b>", bold_cell_style), Paragraph("Issued At:", bold_cell_style), Paragraph(issued_at, cell_style)],
        [Paragraph("Tested By:", bold_cell_style), Paragraph(tech, cell_style), Paragraph("Verified By:", bold_cell_style), Paragraph(verifier, cell_style)],
    ]
    info_tbl = Table(info_data, colWidths=[60, 78, 55, 74])
    info_tbl.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#94a3b8')),
        ('TOPPADDING', (0,0), (-1,-1), 1.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    flowables.append(info_tbl)
    flowables.append(Spacer(1, 2))

    warning_text = "<font size=5.5 color='#b91c1c'><b>SAFETY CHECK:</b> VERIFY CLIENT IDENTITY & DONOR DETAILS PRIOR TO INFUSION. DO NOT INFUSE IF EXPIRED OR SEAL IS BROKEN.</font>"
    flowables.append(Paragraph(warning_text, ParagraphStyle(name="LblWarn", alignment=TA_CENTER, leading=6.5)))

    doc.build(flowables)
    return buffer.getvalue()

def _build_transfusion_table(tests: list, compact: bool = False) -> KeepTogether:
    flowables = []

    hdr_style = ParagraphStyle(name="BtmHdr", fontName=FONT_BOLD, fontSize=9, leading=11)
    subhdr_style = ParagraphStyle(name="BtmSubHdr", fontName=FONT_BOLD, fontSize=8, leading=10)
    body_style = ParagraphStyle(name="BtmBody", fontName=FONT_REGULAR, fontSize=7.5, leading=9.5)
    bold_body_style = ParagraphStyle(name="BtmBoldBody", fontName=FONT_BOLD, fontSize=7.5, leading=9.5)
    danger_style = ParagraphStyle(name="BtmDanger", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=colors.HexColor('#dc2626'))
    success_style = ParagraphStyle(name="BtmSuccess", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=colors.HexColor('#15803d'))
    note_style = ParagraphStyle(name="BtmNote", fontName=FONT_REGULAR, fontSize=7, leading=8.5, textColor=colors.HexColor('#475569'))

    banner = Table([[Paragraph("Blood Transfusion & Immunohematology", hdr_style)]], colWidths=[480])
    banner.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    flowables.append(banner)
    flowables.append(Spacer(1, 4))

    for t in tests:
        t_name = str(t.get("test_name") or "")
        t_name_lower = t_name.lower()
        params = t.get("parameters") or []
        crossmatches = t.get("crossmatches") or []

        if "blood group" in t_name_lower:
            param_dict = {p.get("name"): p.get("result") for p in params}
            anti_a = param_dict.get("Forward Anti-A") or "-"
            anti_b = param_dict.get("Forward Anti-B") or "-"
            anti_d = param_dict.get("Forward Anti-D") or "-"
            a1 = param_dict.get("Reverse A1-cells") or "-"
            b_c = param_dict.get("Reverse B-cells") or "-"
            consolidated = param_dict.get("Consolidated Blood Group") or t.get("result") or "-"

            is_discrepancy = "discrepancy" in str(consolidated).lower()
            res_style = danger_style if is_discrepancy else bold_body_style

            # Check if reverse typing was performed
            has_reverse = any(str(v).strip() not in ("-", "", "Not Done", "None") for v in (a1, b_c))

            bg_data = [
                [Paragraph("<b>ABO & Rh(D) Blood Grouping</b>", subhdr_style), "", "", "", "", ""],
                [Paragraph("Forward Typing:", bold_body_style), Paragraph(f"Anti-A: {anti_a}", body_style), Paragraph(f"Anti-B: {anti_b}", body_style), Paragraph(f"Anti-D: {anti_d}", body_style), "", ""]
            ]
            if has_reverse:
                bg_data.append([Paragraph("Reverse Typing:", bold_body_style), Paragraph(f"A1-cells: {a1}", body_style), Paragraph(f"B-cells: {b_c}", body_style), "", "", ""])
            bg_data.append([Paragraph("Consolidated Group:", bold_body_style), Paragraph(str(consolidated), res_style), "", "", "", ""])

            group_row_idx = len(bg_data) - 1
            bg_tbl = Table(bg_data, colWidths=[100, 95, 95, 95, 45, 50])
            bg_tbl.setStyle(TableStyle([
                ('SPAN', (0,0), (-1,0)),
                ('SPAN', (1, group_row_idx), (-1, group_row_idx)),
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
                ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            flowables.append(bg_tbl)
            flowables.append(Spacer(1, 4))

        elif "direct coombs" in t_name_lower or "indirect coombs" in t_name_lower:
            is_dat = "direct coombs" in t_name_lower
            title = "Direct Antiglobulin Test (DAT / Direct Coombs)" if is_dat else "Indirect Antiglobulin Test (IAT / Antibody Screen)"
            status_val = t.get("result") or ""
            param_dict = {p.get("name"): p.get("result") for p in params}
            if is_dat:
                str_val = param_dict.get("Reaction Strength") or ""
                spec_val = param_dict.get("Reagent Specificity") or ""
                extra = f" | Strength: {str_val} | Reagent: {spec_val}" if str_val else ""
            else:
                extra = ""

            is_pos = "positive" in str(status_val).lower()
            val_style = danger_style if is_pos else body_style

            coombs_data = [
                [Paragraph(f"<b>{title}</b>", subhdr_style), Paragraph(f"{status_val}{extra}", val_style)]
            ]

            if is_pos:
                if is_dat:
                    comment = "Clinical Correlation: Direct Coombs Positive indicates in vivo coating of red blood cells (AIHA / HDN / Drug-induced hemolysis)."
                else:
                    comment = "CRITICAL ALERT: Indirect Coombs Positive indicates circulating unexpected alloantibodies. Mandatory full 3-phase AHG cross-match required."
                coombs_data.append([Paragraph(f"<b>Notice:</b> {comment}", danger_style), ""])

            c_tbl = Table(coombs_data, colWidths=[240, 240])
            c_style = [
                ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0,0), (-1,-1), 2.5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ]
            if is_pos:
                c_style.append(('SPAN', (0,1), (1,1)))
                c_style.append(('BACKGROUND', (0,1), (1,1), colors.HexColor('#fef2f2')))
            c_tbl.setStyle(TableStyle(c_style))
            flowables.append(c_tbl)
            flowables.append(Spacer(1, 4))

        if crossmatches:
            cm_headers = ["Donor Unit ID", "Group", "Product", "Exp. Date", "IS", "37°C", "AHG", "Compatibility", "Release Status"]
            cm_data = [
                [Paragraph("<b>Compatibility Testing (Cross-matching) — Unit Traceability</b>", subhdr_style)] + [""] * 8,
                [Paragraph(f"<b>{h}</b>", subhdr_style) for h in cm_headers]
            ]
            for cm in crossmatches:
                u_id = cm.get("donor_unit_id") or ""
                u_grp = cm.get("donor_blood_group") or ""
                u_prod = cm.get("product_type") or "PRBC"
                u_exp = cm.get("expiry_date") or ""
                p_is = cm.get("phase_is") or "Neg"
                p_th = cm.get("phase_thermophase") or "Neg"
                p_ahg = cm.get("phase_ahg") or "Neg"
                c_stat = cm.get("compatibility_status") or "COMPATIBLE"
                r_stat = cm.get("release_status") or "RELEASED"

                is_compat = (c_stat == "COMPATIBLE")
                st_style = success_style if is_compat else danger_style
                rel_style = success_style if is_compat else danger_style

                cm_data.append([
                    Paragraph(u_id, bold_body_style),
                    Paragraph(u_grp, body_style),
                    Paragraph(u_prod, body_style),
                    Paragraph(u_exp, body_style),
                    Paragraph(p_is, body_style),
                    Paragraph(p_th, body_style),
                    Paragraph(p_ahg, body_style),
                    Paragraph(c_stat, st_style),
                    Paragraph(r_stat, rel_style)
                ])
                sum_text = cm.get("clinical_summary") or ""
                if sum_text:
                    s_style = note_style if is_compat else danger_style
                    cm_data.append([Paragraph(f"Summary: {sum_text}", s_style)] + [""] * 8)

            cm_col_widths = [75, 55, 60, 50, 25, 30, 30, 75, 80]
            cm_tbl = Table(cm_data, colWidths=cm_col_widths)
            cm_t_style = [
                ('SPAN', (0,0), (-1,0)),
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
                ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#f1f5f9')),
                ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]
            curr_row = 2
            for cm in crossmatches:
                curr_row += 1
                if cm.get("clinical_summary"):
                    cm_t_style.append(('SPAN', (0, curr_row), (-1, curr_row)))
                    cm_t_style.append(('BACKGROUND', (0, curr_row), (-1, curr_row), colors.HexColor('#f8fafc')))
                    curr_row += 1

            cm_tbl.setStyle(TableStyle(cm_t_style))
            flowables.append(cm_tbl)
            flowables.append(Spacer(1, 4))

    flowables.append(Spacer(1, 4 if compact else 8))

    return KeepTogether(flowables)

def _build_cbc_patient_header(order_data: dict) -> Table:
    client_no = str(order_data.get("client_number") or order_data.get("client_id") or "")
    date_val = str(order_data.get("ordered_date") or order_data.get("date") or "")
    if "-" in date_val:
        parts = date_val.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            date_val = f"{parts[1]}/{parts[2]}/{parts[0]}"
            
    ref_by = str(order_data.get("requested_by") or order_data.get("ordered_by") or "")
    name = str(order_data.get("full_name") or "")
    age = str(order_data.get("age") or "")
    sex = str(order_data.get("sex") or "")
    if sex.lower().startswith("m"):
        sex = "M"
    elif sex.lower().startswith("f"):
        sex = "F"
    lab_no = str(order_data.get("lab_number") or "")
    ward = str(order_data.get("ward_of_origin") or "OPD")
    specimen = str(order_data.get("specimen") or "EDTA Whole Blood")
    
    data = [
        ["Client No :", client_no, "Name :", name, "Lab No :", lab_no],
        ["Dated     :", date_val, "Age  :", age, "Ward/OPD :", ward],
        ["Ref. By   :", ref_by, "Sex  :", sex, "Specimen :", specimen]
    ]
    
    t = Table(data, colWidths=[70, 85, 45, 120, 65, 95])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Courier'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('FONTNAME', (0,0), (0,-1), 'Courier-Bold'),
        ('FONTNAME', (2,0), (2,-1), 'Courier-Bold'),
        ('FONTNAME', (4,0), (4,-1), 'Courier-Bold'),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    return t

def _normalize_unit(unit_str: str) -> str:
    if not unit_str:
        return ""
    u = unit_str.strip()
    u = u.replace("10³", "10^3").replace("10⁶", "10^6").replace("10⁹", "10^9")
    u = u.replace("µL", "uL").replace("μL", "uL")
    if "10^3" in u and "(" not in u:
        return "(10^3 / uL)"
    if "10^6" in u and "(" not in u:
        return "(10^6 / uL)"
    if "10^9" in u and "(" not in u:
        return "(10^9 / uL)"
    return u

def _build_cbc_footer(order_data: dict, cbc_test: dict) -> Table:
    time_str = ""
    date_str = str(order_data.get("ordered_date") or order_data.get("date") or "")
    if "-" in date_str:
        parts = date_str.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            date_str = f"{parts[1]}/{parts[2]}/{parts[0]}"
            
    timestamp = cbc_test.get("timestamp") or order_data.get("analyzer_timestamp") or ""
    if timestamp and " " in timestamp:
        t_parts = timestamp.split(" ")
        time_str = t_parts[1]
    elif timestamp:
        time_str = timestamp
    else:
        time_str = "12:00:00"
        
    tech = str(order_data.get("technician_name") or "").strip()
    if tech and tech.lower() not in ["technologist signature", "technologist", "signature"]:
        sig_label = f"Technologist Signature ({tech})"
    else:
        sig_label = "Technologist Signature"
    
    data = [
        [time_str, date_str, sig_label]
    ]
    t = Table(data, colWidths=[100, 140, 240])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Courier'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    return t

def _build_cbc_table(order_data: dict, cbc_test: dict) -> list:
    flowables = []
    
    # Title box with border
    header_table = Table([[Paragraph("HAEMATOLOGY CBC REPORT", ParagraphStyle(
        name='CBCTitle',
        fontName='Courier-Bold',
        fontSize=10.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.black
    ))]], colWidths=[480])
    header_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.black),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    flowables.append(header_table)
    flowables.append(Spacer(1, 4))
    
    params = cbc_test.get("parameters", [])
    params_map = {}
    for p in params:
        p_name = (p.get("name") or p.get("test_name") or "").strip().lower()
        if p_name:
            params_map[p_name] = p

    # Determine demographic category (Child vs Adult)
    age_str = str(order_data.get("age") or "").lower()
    is_child = False
    if "m" in age_str or "d" in age_str:
        is_child = True
    else:
        digits = "".join([c for c in age_str if c.isdigit()])
        if digits and int(digits) < 18:
            is_child = True
    demo_category = "Child" if is_child else "Adult"
    sex = str(order_data.get("sex") or "").strip().upper()[:1]

    def get_row(name_matcher, display_name, def_unit, def_ref):
        match = None
        for k, v in params_map.items():
            if name_matcher.lower() in k:
                match = v
                break
        res_val = match.get("result", match.get("value", "")) if match else ""
        raw_unit = match.get("unit", def_unit) if match else def_unit
        unit_val = _normalize_unit(raw_unit)
        flag_val = match.get("flag", "") if match else ""
        ref_val = match.get("reference_range") or match.get("reference") or def_ref if match else def_ref
        
        # Format flag: Low, High, \u26A0, L*, H*
        flag_display = ""
        if flag_val:
            if flag_val in ("\u26A0", "[!]", "*"):
                if FONT_SYMBOL != 'Helvetica':
                    flag_display = Paragraph(f'<font name="{FONT_SYMBOL}" color="#dc2626">\u26A0</font>', ParagraphStyle(name="CbcFlagSym", fontName=FONT_BOLD, fontSize=8, alignment=TA_CENTER))
                else:
                    flag_display = Paragraph('<font color="#dc2626"><b>\u26A0</b></font>', ParagraphStyle(name="CbcFlagSym", fontName=FONT_BOLD, fontSize=8, alignment=TA_CENTER))
            elif flag_val in ("L*", "Low*"): flag_display = "L*"
            elif flag_val in ("H*", "High*"): flag_display = "H*"
            elif flag_val in ("L", "Low", "l"): flag_display = "Low"
            elif flag_val in ("H", "High", "h"): flag_display = "High"
            else: flag_display = str(flag_val)

        return [display_name, str(res_val), str(unit_val or ""), flag_display, f"[ {ref_val} ]" if ref_val else ""]


    # Section 1: Main Indices
    if is_child:
        sec1 = [
            get_row("Total WBC Count", "Total WBC Count", "(10^3 / uL)", "6.0-14.0"),
            get_row("Red Blood Cells", "Red Blood Cells (RBC)", "(10^6 / uL)", "4.00 -5.20"),
            get_row("Hemoglobin", "Hemoglobin (Hb)", "g/dL", "11.5-15.5"),
            get_row("Hematocrit", "Hematocrit (HCT)", "%", "35.0-45.0"),
            get_row("Mean Cell Volume", "Mean Cell Volume (MCV)", "fL", "77.0-95.0"),
            get_row("Mean Cell Hb (MCH)", "Mean Cell Hb (MCH)", "pg", "23.0-31.0"),
            get_row("Mean Cell Hb Conc", "Mean Cell Hb Conc.(MCHC)", "g/dL", "28.0-33.0"),
            get_row("Platelets Count", "Platelets Count", "(10^3 / uL)", "150-450"),
        ]
        sec2 = [
            get_row("Neutrophils (%)", "Neutrophils", "%", "28.0-78.0"),
            get_row("Lymphocytes (%)", "Lymphocytes", "%", "19.0-60.0"),
            get_row("Monocytes (%)", "Monocytes", "%", "2.0-12.0"),
            get_row("Eosinophils (%)", "Eosinophils", "%", "1.0-6.0"),
            get_row("Basophils (%)", "Basophils", "%", "0.0-1.0"),
        ]
        sec3 = [
            get_row("Neutrophils (Absolute", "Neutrophils Count", "(10^9 / uL)", "1.50-8.50"),
            get_row("Lymphocytes (Absolute", "Lymphocytes Count", "(10^9 / uL)", "1.50-7.00"),
            get_row("Monocytes (Absolute", "Monocytes Count", "(10^9 / uL)", "0.20-1.00"),
            get_row("Eosinophils (Absolute", "Eosinophils Count", "(10^9 / uL)", "0.05-0.70"),
            get_row("Basophils (Absolute", "Basophils Count", "(10^9 / uL)", "0.0-0.2"),
        ]
    else:
        # Adult
        sec1 = [
            get_row("Total WBC Count", "Total WBC Count", "(10^3 / uL)", "4.0-10.0"),
            get_row("Red Blood Cells", "Red Blood Cells (RBC)", "(10^6 / uL)", "4.50-5.90" if sex == "M" else "4.00-5.20"),
            get_row("Hemoglobin", "Hemoglobin (Hb)", "g/dL", "13.0-17.5" if sex == "M" else "12.0-15.5"),
            get_row("Hematocrit", "Hematocrit (HCT)", "%", "40.0-52.0" if sex == "M" else "36.0-48.0"),
            get_row("Mean Cell Volume", "Mean Cell Volume (MCV)", "fL", "80.0-100.0"),
            get_row("Mean Cell Hb (MCH)", "Mean Cell Hb (MCH)", "pg", "27.0-34.0"),
            get_row("Mean Cell Hb Conc", "Mean Cell Hb Conc.(MCHC)", "g/dL", "32.0-36.0"),
            get_row("Platelets Count", "Platelets Count", "(10^3 / uL)", "150-400"),
        ]
        sec2 = [
            get_row("Neutrophils (%)", "Neutrophils", "%", "40.0-75.0"),
            get_row("Lymphocytes (%)", "Lymphocytes", "%", "20.0-45.0"),
            get_row("Monocytes (%)", "Monocytes", "%", "2.0-10.0"),
            get_row("Eosinophils (%)", "Eosinophils", "%", "1.0-6.0"),
            get_row("Basophils (%)", "Basophils", "%", "0.0-1.0"),
        ]
        sec3 = [
            get_row("Neutrophils (Absolute", "Neutrophils Count", "(10^9 / uL)", "2.00-7.00"),
            get_row("Lymphocytes (Absolute", "Lymphocytes Count", "(10^9 / uL)", "1.00-3.00"),
            get_row("Monocytes (Absolute", "Monocytes Count", "(10^9 / uL)", "0.20-1.00"),
            get_row("Eosinophils (Absolute", "Eosinophils Count", "(10^9 / uL)", "0.02-0.50"),
            get_row("Basophils (Absolute", "Basophils Count", "(10^9 / uL)", "0.0-0.1"),
        ]

    # Section 4: RBC / Platelet Indices
    sec4 = [
        get_row("RBC Distribution Width", "RBC Distribution Width", "%", "11.0-16.0"),
        get_row("Thrombocrit", "Thrombocrit (PCT)", "%", "0.16-0.33"),
        get_row("Mean Platelet Volume", "Mean Platelet Volume (MPV)", "fL", "6.0 - 10.0"),
        get_row("PLT Distribution Width", "Plt Distribution Width", "%", "12.0 - 18.0"),
    ]

    table_data = [
        ["", "", "", "", demo_category],
        ["Test", "Result", "Units", "Flag", "Ref. Ranges"]
    ]
    
    divider = ["-", "", "", "", ""]

    table_data.extend(sec1)
    table_data.append(divider)
    table_data.extend(sec2)
    table_data.append(divider)
    table_data.extend(sec3)
    table_data.append(divider)
    table_data.extend(sec4)

    t = Table(table_data, colWidths=[160, 55, 75, 50, 140])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Courier'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('FONTNAME', (0,1), (-1,1), 'Courier-Bold'),
        ('FONTSIZE', (0,1), (-1,1), 8.5),
        ('FONTNAME', (4,0), (4,0), 'Courier-Bold'),
        ('ALIGN', (4,0), (4,0), 'CENTER'),
        ('LINEBELOW', (0,1), (-1,1), 1, colors.black),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,2), (1,-1), 'RIGHT'),
        ('ALIGN', (2,2), (2,-1), 'CENTER'),
        ('ALIGN', (3,2), (3,-1), 'CENTER'),
        ('ALIGN', (4,2), (4,-1), 'CENTER'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.6),
        ('TOPPADDING', (0,0), (-1,-1), 1.6),
        ('FONTNAME', (1,2), (1,-1), 'Courier-Bold'),
    ]))
    
    flowables.append(t)
    flowables.append(Spacer(1, 8))
    return flowables


def _build_culture_page(order_data: dict, cs_test: dict) -> list:
    """
    Builds a dedicated A4 page flowables list for Culture & Antimicrobial Susceptibility Report.
    Adheres strictly to BEST_PRACTICES.md:
    - Multi-parameter isolation on dedicated page (Rule 3.3).
    - Client terminology strictly enforced (Rule 3.2).
    - No emojis anywhere (Rule A.1).
    """
    flowables = []
    
    # Dedicated Report Header
    hdr_title_style = ParagraphStyle(
        name='CsReportTitle',
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0f172a')
    )
    flowables.append(Paragraph("CULTURE & ANTIMICROBIAL SUSCEPTIBILITY REPORT", hdr_title_style))
    flowables.append(Spacer(1, 4))
    
    # Metadata Demographics Table (Patient header per Client standard)
    flowables.append(_build_cbc_patient_header(order_data))
    flowables.append(Spacer(1, 6))
    
    # Section Banner Style
    banner_style = ParagraphStyle(name="CsBanner", fontName=FONT_BOLD, fontSize=8.5, leading=10.5, textColor=colors.HexColor('#0f172a'))
    lbl_style = ParagraphStyle(name="CsLbl", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=colors.HexColor('#334155'))
    val_style = ParagraphStyle(name="CsVal", fontName=FONT_REGULAR, fontSize=7.5, leading=9.5, textColor=colors.HexColor('#0f172a'))
    alert_style = ParagraphStyle(name="CsAlert", fontName=FONT_BOLD, fontSize=7.5, leading=10, textColor=colors.HexColor('#b91c1c'))
    
    # 1. Specimen & Preliminary Microscopy Banner
    specimen_title = cs_test.get("test_name") or "Culture & Sensitivity (C&S)"
    micro_text = cs_test.get("preliminary_micro") or "None reported"
    colony_count = cs_test.get("colony_count_cfu") or "None"
    hours = cs_test.get("incubation_hours") or 24
    media = cs_test.get("media_used") or "Standard Media"
    notes = cs_test.get("clinical_notes") or "Routine diagnostic culture."
    
    summary_data = [
        [Paragraph("<b>TEST ORDER:</b>", lbl_style), Paragraph(str(specimen_title), val_style), Paragraph("<b>INCUBATION:</b>", lbl_style), Paragraph(f"{hours} Hours ({media})", val_style)],
        [Paragraph("<b>PRELIMINARY MICRO:</b>", lbl_style), Paragraph(str(micro_text), val_style), Paragraph("<b>COLONY COUNT:</b>", lbl_style), Paragraph(f"{colony_count} CFU/mL" if str(colony_count).isdigit() or "^" in str(colony_count) else str(colony_count), val_style)],
        [Paragraph("<b>CLINICAL NOTES:</b>", lbl_style), Paragraph(str(notes), val_style), Paragraph("", lbl_style), Paragraph("", val_style)]
    ]
    summary_tbl = Table(summary_data, colWidths=[105, 175, 95, 105])
    summary_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    flowables.append(summary_tbl)
    flowables.append(Spacer(1, 5))
    
    # Clinical / Safety Alerts
    alerts = cs_test.get("alerts") or []
    if alerts:
        alert_rows = []
        for al in alerts:
            clean_al = str(al).replace("⚠️", "[ALERT]").replace("🚨", "[EMERGENCY]")
            alert_rows.append([Paragraph(f"<b>CRITICAL NOTICE:</b> {clean_al}", alert_style)])
        alert_tbl = Table(alert_rows, colWidths=[480])
        alert_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fef2f2')),
            ('GRID', (0,0), (-1,-1), 0.6, colors.HexColor('#ef4444')),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ]))
        flowables.append(alert_tbl)
        flowables.append(Spacer(1, 5))
        
    # 2. Isolates & AST Table
    isolates = cs_test.get("isolates") or []
    if not isolates:
        # Check if no growth
        no_growth_msg = cs_test.get("result") or "No significant bacterial growth after 48 hours of aerobic incubation."
        ng_tbl = Table([[Paragraph(f"<b>CULTURE RESULT:</b> {no_growth_msg}", ParagraphStyle(name="Ng", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=colors.HexColor('#1e293b')))]], colWidths=[480])
        ng_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
            ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ]))
        flowables.append(ng_tbl)
        flowables.append(Spacer(1, 10))
    else:
        for idx, iso in enumerate(isolates, start=1):
            iso_name = iso.get("organism_name") or f"Isolate #{idx}"
            morph = iso.get("colony_morphology") or ""
            iso_hdr = f"<b>ISOLATE #{idx}:</b> <i>{iso_name}</i>"
            if morph:
                iso_hdr += f" ({morph})"
                
            iso_banner = Table([[Paragraph(iso_hdr, banner_style)]], colWidths=[480])
            iso_banner.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#e2e8f0')),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                ('LEFTPADDING', (0,0), (-1,-1), 3),
            ]))
            flowables.append(iso_banner)
            flowables.append(Spacer(1, 2))
            
            ast_list = iso.get("ast_results") or []
            if not ast_list:
                flowables.append(Paragraph("<i>No antimicrobial susceptibility testing performed for this isolate.</i>", val_style))
                flowables.append(Spacer(1, 4))
            else:
                # AST Grid
                ast_header = [
                    Paragraph("<b>Antimicrobial Class</b>", lbl_style),
                    Paragraph("<b>Antimicrobial Agent</b>", lbl_style),
                    Paragraph("<b>Measurement</b>", lbl_style),
                    Paragraph("<b>Result (S/I/R)</b>", lbl_style),
                    Paragraph("<b>Interpretation / Guidance</b>", lbl_style)
                ]
                ast_rows = [ast_header]
                for ast in ast_list:
                    aclass = ast.get("antimicrobial_class") or "Other"
                    agent = ast.get("agent_name") or ""
                    m_val = ast.get("measurement_value")
                    m_type = ast.get("measurement_type") or "zone_mm"
                    m_str = f"{m_val} mm" if m_val is not None and m_type == "zone_mm" else (f"{m_val} µg/mL" if m_val is not None else "-")
                    sir = ast.get("overridden_sir") or ast.get("raw_sir") or "N/A"
                    
                    # Color coding for S-I-R text
                    sir_color = '#15803d' if sir == 'S' else ('#b91c1c' if sir == 'R' else '#d97706')
                    sir_para = Paragraph(f"<font color='{sir_color}'><b>{sir}</b></font>", ParagraphStyle(name="Sir", fontName=FONT_BOLD, fontSize=8, leading=10, alignment=TA_CENTER))
                    
                    note = ast.get("override_reason") or ast.get("clinical_note") or ""
                    if sir == 'S':
                        interp = "Susceptible - Standard dosing"
                    elif sir == 'I':
                        interp = "Intermediate - Increased exposure"
                    elif sir == 'R':
                        interp = "Resistant - Clinical failure likely"
                    else:
                        interp = "-"
                    if note:
                        interp += f"<br/><font color='#b91c1c' size=6.5>{note}</font>"
                        
                    ast_rows.append([
                        Paragraph(aclass, val_style),
                        Paragraph(f"<b>{agent}</b>", val_style),
                        Paragraph(m_str, val_style),
                        sir_para,
                        Paragraph(interp, val_style)
                    ])
                    
                ast_tbl = Table(ast_rows, colWidths=[100, 110, 65, 55, 150])
                ast_tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
                    ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#cbd5e1')),
                    ('TOPPADDING', (0,0), (-1,-1), 1.8),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
                    ('LEFTPADDING', (0,0), (-1,-1), 2.5),
                    ('RIGHTPADDING', (0,0), (-1,-1), 2.5),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('ALIGN', (2,1), (3,-1), 'CENTER'),
                ]))
                flowables.append(ast_tbl)
                flowables.append(Spacer(1, 4))
                
    # Footer Signatures
    flowables.append(Spacer(1, 4))
    flowables.append(_build_signatures_table(order_data, compact=True))
    return flowables


from reportlab.platypus import PageBreak

def generate_pdf(order_data: dict, results_data: list) -> bytes:
    buffer = io.BytesIO()
    lab_no = order_data.get("lab_number") or order_data.get("client_number") or ""
    client_name = order_data.get("full_name") or ""
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        leftMargin=SAFE_MARGIN_X, 
        rightMargin=SAFE_MARGIN_X, 
        topMargin=145,
        bottomMargin=65,
        title=f"Lab Report - {lab_no}",
        author=order_data.get("facility_name") or "M-LIS Diagnostic Laboratory",
        creator="M-LIS",
        subject=f"Clinical Diagnostic Report: {client_name} ({lab_no})"
    )
    
    title_style = ParagraphStyle(
        name='ReportTitle',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.black
    )
    
    flowables = []
    
    # Check for CBC and C&S
    cbc_test = None
    cbc_params_collected = []
    cs_tests = []
    other_departments = []
    
    cbc_param_keywords = [
        "wbc", "rbc", "hemoglobin", "hb", "hematocrit", "hct", "mcv", "mch", "mchc", "rdw",
        "platelet", "plt", "pct", "mpv", "pdw", "neutrophil", "lymphocyte", "monocyte", "eosinophil", "basophil"
    ]
    
    for dept_data in results_data:
        dept_name = dept_data.get("department", "UNKNOWN")
        tests = dept_data.get("tests", [])
        
        filtered_tests = []
        for t in tests:
            t_name = str(t.get("test_name") or "").lower()
            if "cbc" in t_name or "complete blood count" in t_name:
                cbc_test = t
            elif "culture & sensitivity" in t_name or "c&s" in t_name or t.get("phase") is not None or t.get("isolates") is not None:
                cs_tests.append(t)
            elif any(k in t_name for k in cbc_param_keywords):
                cbc_params_collected.append(t)
            else:
                filtered_tests.append(t)
                
        if filtered_tests:
            other_departments.append({"department": dept_name, "tests": filtered_tests})

    # If CBC test exists or child params collected, ensure parameters array is complete
    if cbc_test or cbc_params_collected:
        if not cbc_test:
            cbc_test = {"test_name": "Complete Blood Count (CBC)", "parameters": []}
        
        existing_params = cbc_test.get("parameters", [])
        if not existing_params and cbc_params_collected:
            cbc_test["parameters"] = cbc_params_collected

    # If we have other tests, render main report page first
    if other_departments or (not cbc_test and not cs_tests):
        total_tests_count = sum(len(d.get("tests", [])) for d in other_departments)
        is_dense = total_tests_count > 5

        flowables.append(Paragraph("<b>LABORATORY REPORT</b>", title_style))
        flowables.append(Spacer(1, 4 if is_dense else 8))
        flowables.append(_build_metadata_table(order_data))
        flowables.append(Spacer(1, 6 if is_dense else 10))
        
        urinalysis_test = None
        for dept_data in other_departments:
            dept_name = dept_data.get("department", "UNKNOWN")
            tests = dept_data.get("tests", [])
            
            # Group orders by test_name (proxy for test_id)
            grouped_tests = {}
            for t in tests:
                t_name = t.get("test_name", "")
                if t_name not in grouped_tests:
                    grouped_tests[t_name] = []
                grouped_tests[t_name].append(t)
                
            final_tests = []
            for t_name, orders in grouped_tests.items():
                valid_orders = [o for o in orders if str(o.get("result") or "").lower() != "invalid"]
                if valid_orders:
                    final_tests.extend(valid_orders)
                else:
                    first_order = orders[0].copy()
                    first_order["result"] = "Not done"
                    final_tests.append(first_order)
                    
            if "blood transfusion" in dept_name.lower():
                flowables.append(_build_transfusion_table(final_tests, compact=is_dense))
            else:
                tests_to_render = []
                for t in final_tests:
                    if str(t.get("test_name") or "").lower() == "urinalysis":
                        urinalysis_test = t
                    else:
                        tests_to_render.append(t)
                        
                if tests_to_render:
                    flowables.append(_build_department_table(dept_name, tests_to_render, compact=is_dense))
                    flowables.append(Spacer(1, 4 if is_dense else 8))
                
        if urinalysis_test:
            flowables.append(_build_urinalysis_table(urinalysis_test, compact=is_dense))
            
        flowables.append(_build_signatures_table(order_data, compact=is_dense))

    # Render dedicated CBC page if present
    if cbc_test:
        if flowables:
            flowables.append(PageBreak())
        flowables.append(_build_cbc_patient_header(order_data))
        flowables.append(Spacer(1, 6))
        flowables.extend(_build_cbc_table(order_data, cbc_test))
        flowables.append(_build_cbc_footer(order_data, cbc_test))

    # Render dedicated C&S pages for each culture & sensitivity order (Strict Rule 3.3)
    for cs in cs_tests:
        if flowables:
            flowables.append(PageBreak())
        flowables.extend(_build_culture_page(order_data, cs))
    
    custom_letterhead = order_data.get("letterhead_path")
    def make_canvas(*args, **kwargs):
        c = ReportNumberedCanvas(*args, **kwargs)
        c.letterhead_override = custom_letterhead
        return c

    doc.build(flowables, canvasmaker=make_canvas)
    
    return buffer.getvalue()

generate_report_pdf = generate_pdf





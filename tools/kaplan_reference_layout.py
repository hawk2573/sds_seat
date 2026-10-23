"""Simplified tracing of the 2018 Kaplan plan in its 959 x 719 page coordinates.

Room footprints, openings and furniture are approximate visual traces of the
supplied drawing, not surveyed dimensions or a current inventory. Keep this
shared reference in source coordinates so all four zone crops stay aligned.
"""

ROOMS = [
    # x, y, width, height, label, label position as a fraction of room height
    (205, 247, 14, 35, ["Store"], .35),
    (205, 282, 14, 35, ["Store"], .5),
    (220, 247, 14, 35, ["Lact."], .55),
    (220, 283, 29, 34, ["Print"], .52),
    (235, 247, 84, 36, ["Restrooms"], .5),
    (250, 284, 69, 33, ["MDF / IDF"], .55),
    (151, 385, 101, 64, ["Small flex"], .14),
    (151, 449, 101, 70, ["Small flex"], .14),
    (151, 519, 101, 52, ["Small flex"], .16),
    (252, 519, 71, 52, ["Flex / project"], .16),
    (323, 519, 71, 52, ["Flex / project"], .16),
    (394, 519, 58, 52, ["Flex / project"], .16),
    (493, 248, 34, 25, ["Mtg"], .45),
    (493, 273, 34, 43, ["Copy", "/ work"], .38),
    (493, 316, 34, 24, ["Mtg"], .46),
    (493, 340, 34, 45, ["Small", "meeting"], .35),
    (550, 205, 40, 44, ["Small", "meeting"], .23),
    (590, 205, 53, 44, ["Medium", "meeting"], .23),
    (643, 205, 81, 44, ["Small flex"], .23),
    (724, 205, 111, 112, ["Multipurpose"], .13),
    (724, 317, 111, 107, ["Multipurpose"], .13),
    (519, 449, 46, 70, ["Stair"], .13),
    (565, 449, 39, 46, ["Vending"], .4),
    (604, 449, 102, 46, ["Community kitchen"], .47),
    (706, 449, 36, 46, ["Utility"], .45),
    (565, 495, 92, 24, ["Restrooms"], .52),
    (657, 495, 85, 24, ["Restrooms"], .52),
    (519, 519, 46, 36, ["IDF"], .55),
    (565, 529, 47, 26, ["Storage"], .55),
    (742, 449, 101, 106, ["Mechanical", "/ services"], .62),
    (742, 449, 48, 27, ["Electrical"], .5),
]


def draw_reference(m):
    """One connected floor, with subdued neighboring spaces in every zone crop."""
    m.rect(64, 153, 848, 462, "#fff", "#4c6067", 2.3)
    m.zone_fill()
    m.zone_outline()

    # Openings to the lower level and the main circulation crossing.
    m.rect(282, 410, 167, 109, "#f3f6f6", "#899a9f", .8)
    m.label(365, 467, ["OPEN TO BELOW"], 7.5, "#86979b")
    m.line(282, 415, 443, 415, "#b5c3c6", .7)
    m.line(443, 415, 443, 514, "#b5c3c6", .7)
    m.rect(594, 251, 130, 112, "#f3f6f6", "#899a9f", .8)
    m.label(648, 307, ["OPEN TO BELOW"], 7.5, "#86979b")
    m.line(253, 386, 594, 386, "#9badb2", 1)
    m.line(253, 405, 448, 405, "#9badb2", 1)
    m.line(449, 422, 724, 422, "#9badb2", 1)
    m.label(390, 397, ["SHARED CIRCULATION"], 7, "#819399", knockout=True)
    m.line(449, 422, 449, 570, "#9badb2", 1)
    m.line(519, 423, 519, 554, "#9badb2", 1)
    m.label(481, 438, ["Lounge B"], 8)
    m.line(151, 571, 452, 571, "#9badb2", 1)
    m.label(308, 581, ["Lounge A / circulation"], 8, knockout=True)

    # Room envelopes retain their relative placement and proportions.
    for x, y, w, h, lines, fraction in ROOMS:
        faculty_room = y == 519 and 252 <= x <= 394
        fill = "#fff9e9" if m.key == "faculty" and faculty_room else "#f8fafb"
        m.rect(x, y, w, h, fill, "#73868e", 1.1)
        size = 7 if w < 60 else 8
        m.label(x + w / 2, y + h * (.5 if w < 20 else fraction), lines, size, rotation=-90 if w < 20 else 0)

    # Door openings/short swings retained only where visible in the source.
    for x, y, side in [(151, 441, "left"), (151, 511, "left"), (151, 562, "left"),
                       (313, 571, "bottom"), (384, 571, "bottom"), (442, 571, "bottom"),
                       (582, 249, "bottom"), (635, 205, "top"), (716, 249, "bottom"),
                       (555, 519, "bottom"), (738, 495, "bottom")]:
        m.door(x, y, side)

    # The gallery and larger flex area remain open to the workstation aisle.
    m.label(400, 222, ["Exhibition / gallery"], 10)
    m.label(239, 239, ["Base camps"], 7.5)
    m.label(180, 275, ["Crash", "pod"], 7)
    m.label(296, 343, ["Flex", "space"], 8)
    m.label(561, 264, ["STAFF"], 8)
    m.label(666, 409, ["Terrace"], 9)
    m.label(851, 240, ["Project", "spaces"], 6.5)
    m.label(851, 403, ["Digital", "media"], 7)
    m.label(858.5, 528, ["Project", "spaces"], 6.2)
    m.label(681, 563, ["FACULTY WORKSPACES"], 8)

    # Tribune stair, two smaller stairs and the kitchen counters.
    m.rect(319, 248, 174, 89, "#edf3f4", "#9aaeb5", .8)
    for y in range(254, 337, 9):
        m.line(322, y, 490, y, "#bac8cc", .6)
    m.label(402, 292, ["Tribune stair"], 9, knockout=True)
    m.stair(696, 252, 28, 111)
    m.stair(266, 411, 16, 83)
    m.stair(528, 468, 28, 46)
    m.rect(612, 453, 86, 5, "#e2e9eb", "#b0bec3", .6)
    m.rect(612, 483, 86, 5, "#e2e9eb", "#b0bec3", .6)
    m.line(594, 364, 724, 364, "#bac8cc", .6)
    m.line(594, 384, 724, 384, "#bac8cc", .6)

    # Light furniture gives scale/orientation without adding inventory records.
    for x in (167, 201, 236, 270, 303):
        m.table(x, 219, 13, 12)
        m.line(x - 12, 207, x - 12, 231, "#a6b7bd", .8)
        m.line(x - 12, 207, x - 4, 207, "#a6b7bd", .8)
    for x in (142, 223, 302, 691, 758, 825):
        m.round_table(x, 174, 5)
    for x, y in [(166, 256), (184, 269), (185, 299)]:
        m.round_table(x, y, 5)
    for y in (333, 347, 361):
        m.table(233, y, 78, 7, seats=8)
    for top in (385, 449, 519):
        for x in (173, 203, 232):
            for y in (top + 23, top + 42):
                m.table(x, y, 11, 9)
    for x, width in [(286, 18), (356, 18), (422, 16)]:
        m.table(x, 548, width, 12, seats=6)
    m.table(570, 237, 13, 8)
    m.table(617, 237, 21, 8, seats=6)
    m.table(683, 232, 38, 12, seats=8)
    for x, y in [(744, 266), (774, 282), (810, 276), (743, 351), (775, 375), (810, 399)]:
        m.table(x, y, 12, 14)
    for y in (465, 489, 537):
        m.rect(462, y, 7, 13, "#e6edef", "#b0bfc4", .6)
        m.rect(493, y, 7, 13, "#e6edef", "#b0bfc4", .6)
        m.table(482, y + 6, 9, 8, seats=0)
    for x in (170, 200, 229, 275, 304, 333, 377, 406, 434):
        m.table(x, 596, 7, 13)
    for x in (571, 639, 706, 774, 842):
        m.round_table(x, 587, 5)
        m.line(x - 13, 568, x + 10, 568, "#a8b8be", .7)
        m.line(x - 13, 568, x - 13, 605, "#a8b8be", .7)

    # Keep the right-side partitions; the proposed desks replace old loose tables.
    for y in (214, 249, 282, 316, 351, 449, 519, 552):
        m.line(868, y, 891, y, "#9aadb5", 1)
    m.line(835, 206, 835, 424, "#879ba3", 1.1)
    m.line(843, 449, 843, 555, "#879ba3", 1.1)
    m.line(519, 555, 843, 555, "#879ba3", 1.1)

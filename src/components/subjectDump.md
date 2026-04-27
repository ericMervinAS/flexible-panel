{/* Subject avatar grid */}
        <div ref={popoverRef} className="relative">
          <div className="grid grid-cols-5 gap-2">
            {visibleIndices.map((i) => {
              const s = subjects[i];
              const active = selectedSubjects.has(i);
              const applied = !!appliedPresets?.[`subject-${i}`];
              const presetLabel = appliedPresets?.[`subject-${i}`];
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 relative"
                  onMouseEnter={() => applied && setHoveredSubject(i)}
                  onMouseLeave={() => setHoveredSubject(null)}
                >
                  {presetLabel && (
                    <Tooltip label={presetLabel} prefix="Applied:" visible={hoveredSubject === i} />
                  )}
                  <button
                    onClick={() => toggleSubject(i)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent"
                      }`}
                  >
                    <img
                      src={s.avatar}
                      alt={`Subject ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {active && (
                    <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  )}
                  {!active && applied && (
                    <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  )}
                  <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                    {s.count}
                  </span>
                </div>
              );
            })}
            {/* View More is always the 5th cell when there are hidden subjects */}
            {hiddenCount > 0 && (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setPopoverOpen((v) => !v)}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${popoverOpen ? "bg-white/20 text-[#e2e2e2]" : "bg-white/10 text-[#777] hover:bg-white/20 hover:text-[#ababab]"
                    }`}
                >
                  <span className="text-[12px] font-medium leading-none">+{hiddenCount}</span>
                </button>
                <span className="text-[10px] font-medium text-[#777]">View More</span>
              </div>
            )}
          </div>

          {/* View More popover */}
          {popoverOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 bg-[#242424] border border-[#474747] rounded-lg p-3 flex flex-col gap-3 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">All Subjects</span>
              <div className="grid grid-cols-5 gap-2">
                {sortedIndices.map((i) => {
                  const s = subjects[i];
                  const active = selectedSubjects.has(i);
                  const applied = !!appliedPresets?.[`subject-${i}`];
                  const presetLabel = appliedPresets?.[`subject-${i}`];
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 relative"
                      onMouseEnter={() => applied && setHoveredSubject(i)}
                      onMouseLeave={() => setHoveredSubject(null)}
                    >
                      {presetLabel && (
                        <div
                          className={`absolute bottom-[calc(100%-10px)] left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-150 ${hoveredSubject === i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
                          style={hoveredSubject === i ? { transitionDelay: "300ms" } : { transitionDelay: "0ms" }}
                        >
                          <span className="whitespace-nowrap px-[6px] py-[4px] text-[11px] font-medium text-[#474747] bg-[#f6f6f6] rounded-[4px]">
                            {presetLabel}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => toggleSubject(i)}
                        className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent hover:border-[#5e5e5e]"
                          }`}
                      >
                        <img
                          src={s.avatar}
                          alt={`Subject ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {active && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                      {!active && applied && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                      <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                        {s.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
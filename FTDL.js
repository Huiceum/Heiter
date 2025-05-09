class FTDLParser {
    constructor() { this.reset(); }
    reset() {
        this.persons = {}; this.relationships = []; this.notes = [];
        this.styles = []; this.layout = {}; this.metadata = {};
    }
    parse(ftdlText) {
        this.reset();
        const cleanText = ftdlText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const blockRegex = /(person|relationship|note for "([^"]+)"|style for "([^"]+)"|layout|metadata)\s*{([^}]*)}/g;
        let match;
        while ((match = blockRegex.exec(cleanText)) !== null) {
            const blockType = match[1].trim();
            const blockContent = match[4];
            const properties = this.parseProperties(blockContent);
            try {
                if (blockType === 'person') this.parsePerson(properties);
                else if (blockType === 'relationship') this.parseRelationship(properties);
                else if (blockType.startsWith('note for')) this.parseNote(match[2], properties);
                else if (blockType.startsWith('style for')) this.parseStyle(match[3], properties);
                else if (blockType === 'layout') this.parseLayout(properties);
                else if (blockType === 'metadata') this.parseMetadata(properties);
            } catch (e) {
                console.error(`Error parsing block: ${match[0]}\n`, e);
                throw new Error(`Error in ${blockType} block (content: ${blockContent.substring(0,30)}...): ${e.message}`);
            }
        }
        return { persons: this.persons, relationships: this.relationships, notes: this.notes, styles: this.styles, layout: this.layout, metadata: this.metadata };
    }
    parseProperties(propertiesStr) {
        const properties = {};
        const propRegex = /\s*([\w-]+)\s*:\s*(?:"([^"]*)"|\[((?:"[^"]*",?\s*)*[^\]]*)\]|([^,}]+))/g;
        let propMatch;
        while ((propMatch = propRegex.exec(propertiesStr)) !== null) {
            const key = propMatch[1];
            if (propMatch[2] !== undefined) properties[key] = propMatch[2];
            else if (propMatch[3] !== undefined) {
                properties[key] = propMatch[3].split(',')
                    .map(item => item.trim().replace(/^"|"$/g, ''))
                    .filter(item => item.length > 0);
            } else if (propMatch[4] !== undefined) {
                const value = propMatch[4].trim();
                if (value === 'true') properties[key] = true;
                else if (value === 'false') properties[key] = false;
                else if (!isNaN(Number(value))) properties[key] = Number(value);
                else properties[key] = value;
            }
        }
        return properties;
    }
    parsePerson(p) { if (!p.id) throw new Error('Person missing ID'); if(!p.gender) throw new Error(`Person ${p.id} missing gender`); this.persons[p.id] = p; }
    parseRelationship(p) { if (!p.partners || p.partners.length === 0) throw new Error('Relationship missing partners or partners array is empty'); if(!Array.isArray(p.partners)) p.partners = [p.partners]; if(p.children && !Array.isArray(p.children)) p.children = [p.children]; this.relationships.push(p); }
    parseNote(targetId, p) { this.notes.push({ target: targetId, ...p }); }
    parseStyle(selector, p) { this.styles.push({ selector: selector, ...p }); }
    parseLayout(p) { this.layout = p; }
    parseMetadata(p) { this.metadata = p; }
}

class FamilyTreeRenderer {
    constructor(parsedData, previewElement, treeContainerElement) {
        this.data = parsedData;
        this.previewElement = previewElement;
        this.treeContainerElement = treeContainerElement;
        this.renderedCouples = new Set();
        this.processedPersonsAsDescendants = new Set();
        this.injectDefaultStyles();
        this.tooltipElement = null;
        this.createSharedTooltip();
    }

    injectDefaultStyles() {
        if (!this.data.styles) {
            this.data.styles = [];
        }
        const defaultGenderStyles = [
            { selector: "#gender=female", fill_color: "#fce4ec", border_color: "#f48fb1", shape: "circle", _isDefaultGenderStyle: true },
            { selector: "#gender=male", fill_color: "#e8eaf6", border_color: "#7986cb", _isDefaultGenderStyle: true },
        ];
        const probandStyle = { selector: "#proband=true", border_width: "3px", border_style: "double", border_color: "#ff9800" };

        defaultGenderStyles.forEach(defStyle => {
            if (!this.data.styles.some(s => s.selector === defStyle.selector)) {
                this.data.styles.unshift(defStyle);
            }
        });

        if (!this.data.styles.some(s => s.selector === probandStyle.selector)) {
            this.data.styles.unshift(probandStyle);
        }
    }

    createSharedTooltip() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'tooltip';
        if (this.previewElement && this.previewElement.appendChild) {
            this.previewElement.appendChild(this.tooltipElement);
        }
    }
    calculateAge(birthDateStr, deathDateStr) {
        if (!birthDateStr) return null;
        const birthYear = parseInt(birthDateStr.substring(0, 4));
        if (isNaN(birthYear)) return null;
        let endYear;
        if (deathDateStr) endYear = parseInt(deathDateStr.substring(0, 4));
        else endYear = new Date().getFullYear();
        if (isNaN(endYear)) return null;
        return Math.max(0, endYear - birthYear);
    }

    render() {
        this.renderedCouples.clear();
        this.processedPersonsAsDescendants.clear();
        const treeRoot = document.createElement('div');
        treeRoot.className = 'family-tree-root';

        if (this.data?.metadata?.title) {
            const titleEl = document.createElement('h2');
            titleEl.textContent = this.data.metadata.title;
            titleEl.style.textAlign = 'center'; titleEl.style.width = '100%';
            titleEl.style.marginBottom = '30px'; treeRoot.appendChild(titleEl);
        }

        const rootPersons = this.findRootNodes();
        if (Array.isArray(rootPersons)) {
            rootPersons.forEach(rootPersonId => {
                if (rootPersonId && !this.processedPersonsAsDescendants.has(rootPersonId)) {
                    const familyNode = this.renderFamilyNode(rootPersonId, false);
                    if (familyNode) treeRoot.appendChild(familyNode);
                }
            });
        }
        return treeRoot;
    }

    findRootNodes() {
        if (!this.data?.persons || !this.data.relationships) return [];
        const allPersonsIds = Object.keys(this.data.persons);
        const childrenIds = new Set();
        if (Array.isArray(this.data.relationships)) {
            this.data.relationships.forEach(rel => {
                if (rel?.children?.length) {
                    rel.children.forEach(childId => { if (childId) childrenIds.add(childId); });
                }
            });
        }
        return allPersonsIds.filter(id => this.data.persons[id] && !childrenIds.has(id));
    }

    renderFamilyNode(personId, isDescendantInSiblingsRow) {
        const personDataOriginal = this.data.persons[personId];
        if (!personDataOriginal) return null;
        const personData = {...personDataOriginal};
        if (!isDescendantInSiblingsRow && this.processedPersonsAsDescendants.has(personId)) return null;
        this.processedPersonsAsDescendants.add(personId);

        const familyNodeDiv = document.createElement('div');
        familyNodeDiv.className = 'family-node';
        
        const coupleRowDiv = document.createElement('div');
        coupleRowDiv.className = 'couple-row'; // Parents will be side-by-side here

        const personElement = this.renderPerson(personData, isDescendantInSiblingsRow);
        if (!personElement) return null;

        let childrenToRender = null;
        let relationshipForChildren = null; 
        let marriageLineBarElement = null; // Will hold the new marriage bar (─)
        let partnerFoundAndProcessed = false;

        const personRelationships = this.data.relationships.filter(r => r.partners?.includes(personId));

        for (const rel of personRelationships) {
            if (partnerFoundAndProcessed || !rel.partners) continue;

            const otherPartnerId = rel.partners.find(p => p !== personId);

            if (otherPartnerId && this.data.persons[otherPartnerId]) {
                const coupleKey = [personId, otherPartnerId].sort().join('-');
                if (!this.renderedCouples.has(coupleKey)) {
                    this.renderedCouples.add(coupleKey);
                    const partnerData = {...this.data.persons[otherPartnerId]};
                    const partnerElement = this.renderPerson(partnerData, false);
                    if (!partnerElement) continue;

                    // Create the marriage line bar element (this is the new horizontal bar with info)
                    marriageLineBarElement = this.renderMarriage(rel); 

                    const personIdx = rel.partners.indexOf(personId);
                    const partnerIdx = rel.partners.indexOf(otherPartnerId);

                    // Add person and partner to coupleRowDiv, ordered correctly
                    if (personIdx !== -1 && partnerIdx !== -1 && personIdx < partnerIdx) {
                        coupleRowDiv.appendChild(personElement);
                        coupleRowDiv.appendChild(partnerElement);
                    } else if (personIdx !== -1 && partnerIdx !== -1 && partnerIdx < personIdx) {
                        coupleRowDiv.appendChild(partnerElement);
                        coupleRowDiv.appendChild(personElement);
                    } else { // Fallback if indexing is unusual
                        coupleRowDiv.appendChild(personElement);
                        coupleRowDiv.appendChild(partnerElement);
                    }

                    if (rel.children?.length) {
                        childrenToRender = rel.children;
                        relationshipForChildren = rel;
                    }
                    this.processedPersonsAsDescendants.add(otherPartnerId);
                    partnerFoundAndProcessed = true; 
                }
            } else if (rel.partners.length === 1 && rel.partners[0] === personId && rel.children?.length) {
                 // Single parent with children
                 if (!childrenToRender) { 
                    childrenToRender = rel.children;
                    relationshipForChildren = rel;
                 }
            }
        }
        
        // If personElement hasn't been added to coupleRowDiv (e.g., single person, or main person not part of processed couple)
        if (coupleRowDiv.children.length === 0) {
            coupleRowDiv.appendChild(personElement);
        }
        
        familyNodeDiv.appendChild(coupleRowDiv);

        // Add the new marriage presentation structure (vertical lines + horizontal bar)
        // This is added only if marriageLineBarElement was created (i.e., for a couple relationship)
        if (marriageLineBarElement) {
            const marriagePresentationDiv = document.createElement('div');
            marriagePresentationDiv.className = 'marriage-presentation'; // Container for visual marriage line structure

            const connectorsAndBar = document.createElement('div');
            connectorsAndBar.className = 'parent-lines-and-bar'; // For ｜---｜ structure

            // Left vertical line descending from parent
            const leftParentLine = document.createElement('div');
            leftParentLine.className = 'parent-descender-line';
            connectorsAndBar.appendChild(leftParentLine);

            // The marriage bar itself (---)
            connectorsAndBar.appendChild(marriageLineBarElement); 

            // Right vertical line descending from parent
            const rightParentLine = document.createElement('div');
            rightParentLine.className = 'parent-descender-line';
            connectorsAndBar.appendChild(rightParentLine);
            
            marriagePresentationDiv.appendChild(connectorsAndBar);
            familyNodeDiv.appendChild(marriagePresentationDiv);
        }

        if (childrenToRender) {
            // Children connect visually below the marriagePresentationDiv (if it exists) or coupleRowDiv.
            // The `parent-to-children-line` in `renderChildren` will handle the vertical connection downwards.
            this.renderChildren(familyNodeDiv, childrenToRender, relationshipForChildren);
        }
        return familyNodeDiv;
    }

    renderPerson(personData, isDescendantInSiblingsRow = false) {
        if (!personData?.id) return null;
        const personDiv = document.createElement('div');
        personDiv.className = 'person';
        personDiv.setAttribute('data-id', personData.id);

        if (personData.gender) personDiv.classList.add(personData.gender);
        if (personData.proband) personDiv.classList.add('proband');
        if (isDescendantInSiblingsRow) personDiv.classList.add('descendant-link');

        this.applyStyles(personDiv, personData);

        if (personData.gender === 'female' && !personDiv.style.borderRadius && !this.elementHasRectangleStyleFromFtdl(personDiv, personData, this.data.styles)) {
            personDiv.classList.add('female'); 
        }


        const age = this.calculateAge(personData.birth, personData.death);
        if (age !== null && !personData.proband) {
            const ageEl = document.createElement('span'); ageEl.className = 'age';
            ageEl.textContent = personData.death ? `${age} (逝)` : age;
            personDiv.appendChild(ageEl);
        }
        if (personData.name) {
            const nameEl = document.createElement('div'); nameEl.className = 'name';
            nameEl.textContent = personData.name; personDiv.appendChild(nameEl);
        } else if (isDescendantInSiblingsRow || personData.gender === 'female') { 
             const nameEl = document.createElement('div'); nameEl.className = 'name';
             nameEl.innerHTML = ' '; personDiv.appendChild(nameEl); 
        }
        if (personData.birth || personData.death) {
            const datesEl = document.createElement('div'); datesEl.className = 'dates';
            let datesText = personData.birth ? personData.birth.substring(0,10) : '';
            if (personData.birth && personData.death) datesText += ' - ';
            else if (!personData.birth && personData.death) datesText += ' - '; 
            datesText += personData.death ? personData.death.substring(0,10) : '';
            datesEl.textContent = datesText.trim() === '-' ? '' : datesText;
            if (datesEl.textContent || (personData.birth && !personData.death)) personDiv.appendChild(datesEl);
        }
        const personNotes = this.data.notes.filter(note => note.target === personData.id);
        if (personNotes[0]?.text) {
            const noteEl = document.createElement('div'); noteEl.className = 'note-preview';
            noteEl.textContent = personNotes[0].text.split('\n')[0]; personDiv.appendChild(noteEl);
        }
        const tooltipContent = this.buildTooltipContent(personData, personNotes, age);
        personDiv.addEventListener('mousemove', (e) => {
            if (!this.tooltipElement) return;
            this.tooltipElement.innerHTML = tooltipContent;
            this.tooltipElement.style.visibility = 'visible'; this.tooltipElement.style.opacity = '1';
            const pr = this.previewElement.getBoundingClientRect();
            let x = e.clientX - pr.left + this.previewElement.scrollLeft + 15;
            let y = e.clientY - pr.top + this.previewElement.scrollTop + 15;
            if (x + this.tooltipElement.offsetWidth > this.previewElement.scrollLeft + pr.width) x = e.clientX - pr.left + this.previewElement.scrollLeft - this.tooltipElement.offsetWidth - 15;
            if (y + this.tooltipElement.offsetHeight > this.previewElement.scrollTop + pr.height) y = e.clientY - pr.top + this.previewElement.scrollTop - this.tooltipElement.offsetHeight - 15;
            this.tooltipElement.style.left = `${x}px`; this.tooltipElement.style.top = `${y}px`;
        });
        personDiv.addEventListener('mouseleave', () => {
             if (!this.tooltipElement) return;
            this.tooltipElement.style.visibility = 'hidden'; this.tooltipElement.style.opacity = '0';
        });
        return personDiv;
    }

    elementHasRectangleStyleFromFtdl(element, personData, ftdlStyles) {
        if (!ftdlStyles) return false;
        return ftdlStyles.some(style => {
            if (!style || !style.selector) return false;
            let match = false;
            if (style.selector === personData.id) match = true;
            else if (style.selector === `#gender=${personData.gender}`) match = true;
            else if (style.selector === `#proband=true` && personData.proband) match = true;
            return match && style.shape === 'rectangle';
        });
    }


    buildTooltipContent(pd, notes, age) {
        if (!pd) return ""; let h = `<p><strong>ID:</strong> ${pd.id||'N/A'}</p>`;
        if (pd.name) h+=`<p><strong>姓名:</strong> ${pd.name}</p>`; h+=`<p><strong>性別:</strong> ${pd.gender||'N/A'}</p>`;
        if (pd.birth) h+=`<p><strong>生日:</strong> ${pd.birth}</p>`; if (pd.death) h+=`<p><strong>忌日:</strong> ${pd.death}</p>`;
        if (age!==null) h+=`<p><strong>年齡:</strong> ${age}${pd.death?' (逝世時)':''}</p>`;
        if (pd.proband) h+=`<p style="color: lightgreen;"><strong>(案主)</strong></p>`;
        if(Array.isArray(notes)) notes.forEach(n => { if(n?.text) h+=`<p><strong>備註:</strong> ${n.text.replace(/\n/g,'<br>')}</p>`;});
        return h;
    }

    applyStyles(element, personData) {
        const genderColorToggle = document.getElementById('toggle-gender-color-btn');
        const showGenderColors = genderColorToggle ? genderColorToggle.checked : true;
        const isDarkMode = document.body.classList.contains('dark-mode');

        element.style.backgroundColor = '';
        element.style.borderColor = '';

        this.data.styles.forEach(style => {
            if (!style || !style.selector) return;

            let match = false;
            if (style.selector === personData.id) match = true;
            else if (style.selector === `#gender=${personData.gender}`) match = true;
            else if (style.selector === `#proband=true` && personData.proband) match = true;

            if (match) {
                let allowFtdlFillColor = true;
                let allowFtdlBorderColor = true;

                if (style._isDefaultGenderStyle && isDarkMode && showGenderColors) {
                    allowFtdlFillColor = false;
                    allowFtdlBorderColor = false;
                }

                if (!showGenderColors && style._isDefaultGenderStyle && style.selector !== personData.id) {
                    allowFtdlFillColor = false;
                    allowFtdlBorderColor = false;
                }

                if (style.fill_color && allowFtdlFillColor) {
                    element.style.backgroundColor = style.fill_color;
                }
                if (style.border_color && allowFtdlBorderColor) {
                    element.style.borderColor = style.border_color;
                }

                if (style.border_width) element.style.borderWidth = style.border_width;
                if (style.border_style) element.style.borderStyle = style.border_style;

                if (style.shape === 'circle') {
                    if (style.selector === `#gender=female` || (personData.gender === 'female' && style.selector === personData.id && !this.data.styles.some(s => s.selector === personData.id && s.shape === 'rectangle'))) {
                         element.classList.add('female'); 
                    }
                    element.style.borderRadius = '50%';
                } else if (style.shape === 'rectangle') {
                    element.classList.remove('female'); 
                    element.style.borderRadius = '8px'; 
                }
            }
        });
    }

    // renderMarriage now creates the horizontal bar (---) with marriage info, to be placed below parents.
    renderMarriage(rel) { // `rel` is the relationship object
        const barElement = document.createElement('div');
        // This class is for the new horizontal bar. CSS will define its appearance.
        // It replaces the concept of the old 'marriage-line' that was between parents.
        barElement.className = 'marriage-line-bar'; 

        if (rel?.status) {
            // Add status class (e.g., status-divorced) for potential icon styling via CSS
            barElement.classList.add(`status-${rel.status}`);
        }

        if (rel && (rel.start_date || rel.status || rel.end_date)) {
            const info = document.createElement('div');
            info.className = 'marriage-info'; // Re-use for styling the text content on the bar
            
            let txt = '';
            if (rel.start_date) {
                txt += `m. ${rel.start_date.substring(0,4)}`;
            }

            // Handle status text and end date for statuses like divorced, separated
            if (rel.status && rel.status !== "married" && rel.status !== "widowed") {
                 txt += (txt ? ' ' : '') + `(${rel.status.substring(0,3)}${rel.end_date ? '. ' + rel.end_date.substring(0,4) : ''})`;
            } 
            // Handle end date for widowed status or implicit end due to death
            else if (rel.end_date) {
                let isWidowedOrEndedByDeath = rel.status === "widowed";
                if (!isWidowedOrEndedByDeath && rel.partners && rel.partners.length >= 1) { // Check partners for death dates
                    const p1Id = rel.partners[0];
                    const p2Id = rel.partners.length > 1 ? rel.partners[1] : null;
                    
                    const p1Death = this.data.persons[p1Id]?.death;
                    const p2Death = p2Id ? this.data.persons[p2Id]?.death : null;

                    const endDateYear = rel.end_date.substring(0,4);

                    if ((p1Death && p1Death.startsWith(endDateYear)) || (p2Death && p2Death.startsWith(endDateYear))) {
                        isWidowedOrEndedByDeath = true; 
                    }
                }
                // Append end date if it's a "widowed" type of ending, or if it's a non-married/non-widowed status that already includes end_date.
                // Avoid double printing end_date if already handled by (status.substring(0,3) + end_date)
                if (isWidowedOrEndedByDeath && !(rel.status && rel.status !== "married" && rel.status !== "widowed")) {
                     txt += (txt ? ' ' : '') + `- ${rel.end_date.substring(0,4)}`;
                }
            }
            
            info.textContent = txt.trim();
            if (info.textContent) {
                barElement.appendChild(info);
            }
        }
        return barElement; // This is the div for the horizontal bar ---
    }

    renderChildren(parentNode, childrenIds, relCtx) {
        if (!childrenIds?.length) return;
        const container = document.createElement('div'); container.className = 'children-container';
        
        // This line connects from the marriage bar (or couple row for single parents) 
        // down to the horizontal line connecting siblings.
        const p2cLine = document.createElement('div'); p2cLine.className = 'parent-to-children-line';
        container.appendChild(p2cLine);
        
        const sLineCont = document.createElement('div'); sLineCont.className = 'siblings-connector-line-container';
        const sLine = document.createElement('div'); sLine.className = 'siblings-connector-line';
        sLineCont.appendChild(sLine); 
        container.appendChild(sLineCont);
        
        const siblingsRow = document.createElement('div'); siblingsRow.className = 'siblings-row';
        childrenIds.forEach(cId => {
            const cData = this.data.persons[cId];
            if (cData) {
                // Pass true for isDescendantInSiblingsRow
                const cNode = this.renderFamilyNode(cId, true); 
                if (cNode) siblingsRow.appendChild(cNode);
            }
        });
        
        if (siblingsRow.children.length > 0) { 
            container.appendChild(siblingsRow); 
            parentNode.appendChild(container); 
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const editorTextarea = document.getElementById('ftdl-editor');
    const editorContainer = document.querySelector('.editor-container');
    const previewWrapper = document.getElementById('preview-wrapper');
    const renderBtn = document.getElementById('render-btn');
    const previewDiv = document.getElementById('preview');
    const treeContainer = document.getElementById('family-tree-container');
    const errorMessageDiv = document.getElementById('error-message');
    const toggleGenderColorBtn = document.getElementById('toggle-gender-color-btn');
    const toggleEditorBtn = document.getElementById('toggle-editor-btn');
    const toggleDarkModeBtn = document.getElementById('toggle-dark-mode-btn');

    const userTextInput = document.getElementById('user-text-input');
    const runDialogueBtn = document.getElementById('run-dialogue-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    const allControls = [ editorTextarea, renderBtn, toggleEditorBtn, toggleGenderColorBtn, toggleDarkModeBtn,
        userTextInput, runDialogueBtn, document.getElementById('zoom-in-btn'),
        document.getElementById('zoom-out-btn'), document.getElementById('zoom-reset-btn')
    ].filter(el => el);

    function setControlsDisabled(isDisabled) {
        allControls.forEach(c => { if(c) c.disabled = isDisabled; });
        if (!isDisabled && runDialogueBtn && loadingOverlay && !loadingOverlay.style.display.includes('flex')) { 
             runDialogueBtn.disabled = false;
        }
    }
    function showLoading(msg="讀取中...") {
        if(loadingOverlay){
            loadingOverlay.textContent=msg;
            loadingOverlay.style.display='flex';
        }
        setControlsDisabled(true);
    }
    function hideLoading() {
        if(loadingOverlay) loadingOverlay.style.display='none';
        setControlsDisabled(false);
    }


    if (typeof GoogleInteractionHandler !== 'undefined') {
        const googleInteraction = new GoogleInteractionHandler(
            userTextInput,
            editorTextarea,
            loadingOverlay,
            showLoading,
            hideLoading
        );

        if (runDialogueBtn && userTextInput && editorTextarea) {
            runDialogueBtn.addEventListener('click', async () => {
                await googleInteraction.handleRunDialogue();
            });
        }
    } else {
        console.warn("GoogleInteractionHandler is not defined. Dialogue features may be affected.");
        // if(runDialogueBtn) runDialogueBtn.disabled = true; // Optionally disable if critical
    }


    let currentScale = 1, isPanning = false, startX, startY, scrollLeftInit, scrollTopInit;
    if(document.getElementById('zoom-in-btn')&&treeContainer) document.getElementById('zoom-in-btn').addEventListener('click',()=>{currentScale=Math.min(3,currentScale+0.1); treeContainer.style.transform=`scale(${currentScale})`;});
    if(document.getElementById('zoom-out-btn')&&treeContainer) document.getElementById('zoom-out-btn').addEventListener('click',()=>{currentScale=Math.max(0.2,currentScale-0.1); treeContainer.style.transform=`scale(${currentScale})`;});
    if(document.getElementById('zoom-reset-btn')&&treeContainer) document.getElementById('zoom-reset-btn').addEventListener('click',()=>{currentScale=1; treeContainer.style.transform=`scale(${currentScale})`;});
    if(previewDiv){
        previewDiv.addEventListener('mousedown',(e)=>{if(e.target!==previewDiv&&e.target!==treeContainer&&!e.target.closest('.person'))return; isPanning=true; startX=e.pageX-previewDiv.offsetLeft; startY=e.pageY-previewDiv.offsetTop; scrollLeftInit=previewDiv.scrollLeft; scrollTopInit=previewDiv.scrollTop; previewDiv.style.cursor='grabbing';});
        previewDiv.addEventListener('mouseleave',()=>{if(isPanning){isPanning=false; previewDiv.style.cursor='grab';}});
        previewDiv.addEventListener('mouseup',()=>{if(isPanning){isPanning=false; previewDiv.style.cursor='grab';}});
        previewDiv.addEventListener('mousemove',(e)=>{if(!isPanning)return; e.preventDefault(); const x=e.pageX-previewDiv.offsetLeft, y=e.pageY-previewDiv.offsetTop; previewDiv.scrollLeft=scrollLeftInit-(x-startX); previewDiv.scrollTop=scrollTopInit-(y-startY);});
    }

    function updateGenderColorPreferenceAndRender() {
        if (!treeContainer || !toggleGenderColorBtn) return;
        if (toggleGenderColorBtn.checked) treeContainer.classList.remove('no-gender-colors');
        else treeContainer.classList.add('no-gender-colors');
        if (rendererInstance) doRender();
    }
    if(toggleGenderColorBtn) toggleGenderColorBtn.addEventListener('change', updateGenderColorPreferenceAndRender);

    if (toggleDarkModeBtn) {
        const darkModePref = localStorage.getItem('darkMode');
        if (darkModePref === 'enabled') {
            document.body.classList.add('dark-mode');
            toggleDarkModeBtn.textContent = '切換到明亮模式';
        } else {
            toggleDarkModeBtn.textContent = '切換到黑暗模式';
        }

        toggleDarkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            if (document.body.classList.contains('dark-mode')) {
                localStorage.setItem('darkMode', 'enabled');
                toggleDarkModeBtn.textContent = '切換到明亮模式';
            } else {
                localStorage.setItem('darkMode', 'disabled');
                toggleDarkModeBtn.textContent = '切換到黑暗模式';
            }
            if (rendererInstance) doRender(); 
        });
    }


    if (toggleEditorBtn && editorTextarea && editorContainer && previewWrapper) {
        toggleEditorBtn.addEventListener('click', () => {
            editorTextarea.classList.toggle('hidden');
            editorContainer.classList.toggle('editor-hidden');
            toggleEditorBtn.textContent = editorTextarea.classList.contains('hidden') ? '顯示編輯器' : '隱藏編輯器';
            setTimeout(adjustSiblingConnectorLines, 550); 
        });
    }

    function adjustSiblingConnectorLines() {
        if (!treeContainer) return;
        treeContainer.querySelectorAll('.siblings-connector-line').forEach(lineEl => {
            const lineContEl = lineEl.parentElement; if (!lineContEl) return;
            const p2cLineEl = lineContEl.previousElementSibling; // This is .parent-to-children-line
            // Reset transform before recalculating for parent-to-children-line
            if (p2cLineEl?.classList.contains('parent-to-children-line')) { 
                p2cLineEl.style.transform = 'translateX(0px)'; 
                // p2cLineEl.style.marginLeft = '0px'; // Avoid direct margin manipulation if possible
            }
            const siblingsRow = lineContEl.nextElementSibling; // This is .siblings-row
            if (!siblingsRow || !siblingsRow.classList.contains('siblings-row') || siblingsRow.children.length === 0) { 
                lineEl.style.width='0px'; lineEl.style.left='0px'; return; 
            }
            const descPersons = Array.from(siblingsRow.querySelectorAll('.person.descendant-link'));
            if (descPersons.length === 0) { 
                lineEl.style.width='0px'; lineEl.style.left='0px'; return; 
            }
            
            const lcr = lineContEl.getBoundingClientRect(); // Bounding rect of siblings-connector-line-container
            const fdr = descPersons[0].getBoundingClientRect(); // First descendant
            const lastdr = descPersons[descPersons.length-1].getBoundingClientRect(); // Last descendant

            if((fdr.width===0&&fdr.height===0)||(lastdr.width===0&&lastdr.height===0)||(lcr.width===0&&lcr.height===0)){
                lineEl.style.width='0px';lineEl.style.left='0px'; return;
            } 
            
            const fcRel = (fdr.left - lcr.left) + (fdr.width / 2); // Center of first child relative to line container
            const lcRel = (lastdr.left - lcr.left) + (lastdr.width / 2); // Center of last child relative to line container
            
            let slMinLRel, slMaxRRel;
            if(descPersons.length === 1){ 
                const singleCRel = fcRel; 
                slMinLRel = singleCRel - 1; // Small width for single child connector point
                slMaxRRel = singleCRel + 1; 
                lineEl.style.width = '2px'; 
                lineEl.style.left = `${slMinLRel}px`;
            } else {
                slMinLRel = Math.min(fcRel, lcRel); 
                slMaxRRel = Math.max(fcRel, lcRel); 
                lineEl.style.left = `${slMinLRel}px`; 
                lineEl.style.width = `${Math.max(2, slMaxRRel - slMinLRel)}px`;
            }
            
            // Adjust the parent-to-children-line (p2cLineEl) to align with the center of the siblings connector line (slMidAbsX)
            if(p2cLineEl?.classList.contains('parent-to-children-line')){
                const childrenContEl = lineContEl.parentElement; // This is .children-container
                const childContR = childrenContEl.getBoundingClientRect();
                
                // Midpoint of the *actual drawn* siblings-connector-line, in absolute page coordinates
                const slMidAbsX = lcr.left + slMinLRel + (parseFloat(lineEl.style.width) / 1.9);
                
                // Midpoint of the parent-to-children-line's container (.children-container), in absolute page coordinates
                // Assuming p2cLineEl is to be centered within its natural flow in childrenContEl before transform
                const p2cLineOriginalAbsX = p2cLineEl.getBoundingClientRect().left + (p2cLineEl.getBoundingClientRect().width / 2);

                // Calculate the translation needed to move p2cLineEl's center to slMidAbsX
                const translateX = slMidAbsX - p2cLineOriginalAbsX;
                p2cLineEl.style.transform = `translateX(${translateX}px)`;
            }
        });
    }

    let rendererInstance = null;
    function doRender() {
        const ftdlCode = editorTextarea ? editorTextarea.value : "";
        const treeHolder = document.getElementById('family-tree-container');
        if (treeHolder) treeHolder.innerHTML = ''; else { console.error("#family-tree-container not found."); return; }
        if (errorMessageDiv) { errorMessageDiv.style.display='none'; errorMessageDiv.textContent='';}
        try {
            const parser = new FTDLParser();
            const parsedData = parser.parse(ftdlCode);
            if (!parsedData || !parsedData.persons || Object.keys(parsedData.persons).length === 0) {
                if (treeHolder) treeHolder.innerHTML = '<p style="text-align:center; color: #777;">無數據可渲染。</p>';
                return;
            }
            rendererInstance = new FamilyTreeRenderer(parsedData, previewDiv, treeContainer);
            const treeElement = rendererInstance.render();
            if (treeHolder && treeElement) treeHolder.appendChild(treeElement);

            if (toggleGenderColorBtn) { 
                 if (toggleGenderColorBtn.checked) treeContainer.classList.remove('no-gender-colors');
                 else treeContainer.classList.add('no-gender-colors');
            }

            requestAnimationFrame(() => { requestAnimationFrame(adjustSiblingConnectorLines); });
        } catch (e) {
            console.error("FTDL Render Error:", e);
            if (errorMessageDiv) { errorMessageDiv.textContent=`渲染錯誤: ${e.message}\n${e.stack||''}`; errorMessageDiv.style.display='block';}
        }
    }

    if (renderBtn) renderBtn.addEventListener('click', doRender);
    if (editorTextarea?.value.trim()) doRender(); 
});
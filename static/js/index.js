import ContactService from './ContactService.min.js';

// Service Initialization - Sets up the contact service with error messaging
const service = new ContactService(window.API_BASE_PATH, (message) => showSnackbar(message));

// DOM Elements
const DOM = {
    listContent: document.getElementById('list-content'),
    searchInput: document.getElementById('search-field'),
    searchBtn: document.getElementById('btn-search'),
    sortBtn: document.getElementById('btn-sort'),
    detailsNone: document.getElementById('details-none'),
    detailsView: document.getElementById('details-view'),
    detailsEdit: document.getElementById('details-edit'),
    detailsNew: document.getElementById('details-new'),
    container: document.querySelector('.container'),
    backBtn: document.getElementById('btn-back'),
    listNavigation: document.getElementById('list-navigation'),
    btnNew: document.getElementById('btn-new'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    resultSummary: document.getElementById('result-summary'),
    viewName: document.getElementById('details-view-first'),
    viewOccupation: document.getElementById('details-view-occupation'),
    viewEmailList: document.querySelector('#details-view .email-container ul'),
    viewEmailContainer: document.querySelector('#details-view .email-container'),
    viewPhoneList: document.querySelector('#details-view .phone-container ul'),
    viewPhoneContainer: document.querySelector('#details-view .phone-container'),
    viewAddressList: document.querySelector('#details-view .address-container ul'),
    viewAddressContainer: document.querySelector('#details-view .address-container'),
    viewDetailsList: document.querySelector('#details-view .details-container ul'),
    editBtn: document.getElementById('btn-edit'),
    editFirstName: document.getElementById('details-edit-first'),
    editLastName: document.getElementById('details-edit-first-last'),
    editBirthdate: document.getElementById('details-edit-birthdate'),
    editOccupation: document.getElementById('details-edit-occupation'),
    editEmailList: document.querySelector('#details-edit .email-container ul'),
    editAddEmailBtn: document.querySelector('#details-edit .email-container .btn-input-list-add'),
    editPhoneList: document.querySelector('#details-edit .phone-container ul'),
    editAddPhoneBtn: document.querySelector('#details-edit .phone-container .btn-input-list-add'),
    editAddressList: document.querySelector('#details-edit .address-container ul'),
    editAddAddressBtn: document.querySelector('#details-edit .address-container .btn-input-list-add'),
    editNotes: document.getElementById('details-edit-notes'),
    editSaveBtn: document.querySelector('#details-edit .btn-save'),
    editCancelBtn: document.getElementById('btn-cancel'),
    editDeleteBtn: document.getElementById('btn-delete'),
    newFirstName: document.getElementById('details-new-first'),
    newLastName: document.getElementById('details-new-last'),
    newBirthdate: document.getElementById('details-new-birthdate'),
    newOccupation: document.getElementById('details-new-occupation'),
    newEmailList: document.querySelector('#details-new .email-container ul'),
    newAddEmailBtn: document.querySelector('#details-new .email-container .btn-input-list-add'),
    newPhoneList: document.querySelector('#details-new .phone-container ul'),
    newAddPhoneBtn: document.querySelector('#details-new .phone-container .btn-input-list-add'),
    newAddressList: document.querySelector('#details-new .address-container ul'),
    newAddAddressBtn: document.querySelector('#details-new .address-container .btn-input-list-add'),
    newNotes: document.getElementById('details-new-notes'),
    newSaveBtn: document.querySelector('#details-new .btn-save'),
    newCancelBtn: document.querySelector('#details-new .btn-cancel'),
    deleteDialog: document.getElementById('delete-confirm'),
    deleteConfirmBtn: document.getElementById('btn-confirm-delete'),
    deleteCancelBtn: document.getElementById('delete-cancel'),
    unsavedDialog: document.getElementById('unsaved-changes-dialog'),
    unsavedConfirmBtn: document.getElementById('unsaved-confirm'),
    unsavedCancelBtn: document.getElementById('unsaved-cancel'),
    snackbar: document.getElementById('snackbar'),
    loadingBar: document.getElementById('loading-bar')
};

// State
let currentContactId = null, isDescending = false, pageCount = 10, currentPage = 1, totalPages = 1, totalCount = 0;
let activeController = null, isFormDirty = false;

// Consts
const CLIENT_BASE_PATH = window.CLIENT_BASE_PATH;
const TITLE_BASE = 'FriendFile';

// Initialize - Sets up the app on load and handles browser navigation
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    await parseInitialUrl();
    M.CharacterCounter.init([DOM.searchInput, DOM.editFirstName, DOM.editLastName, DOM.editOccupation, DOM.editNotes, DOM.newFirstName, DOM.newLastName, DOM.newOccupation, DOM.newNotes]);
    hideLoading();
});
window.addEventListener('popstate', async () => {
    showLoading();
    await parseInitialUrl();
    hideLoading();
});

// API Request Wrapper - Handles API calls with loading and error states
async function requestWrapper(requestFn, errorMessage = 'Request failed') {
    showLoading();
    activeController = new AbortController();
    try {
        const response = await requestFn(activeController.signal);
        if (!response || response.status !== 'success') throw new Error(errorMessage);
        return response;
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error(`Error: ${e.message}`);
            showSnackbar(e.message || errorMessage);
        }
        return null;
    } finally {
        activeController = null;
        hideLoading();
    }
}

// Dirty Form Handling - Manages unsaved changes dialog
function markFormDirty() {
    isFormDirty = true;
}

function resetFormDirty() {
    isFormDirty = false;
}

function confirmNavigation(callback, newPath = '', newQuery = '') {
    if (isFormDirty && (DOM.detailsEdit.style.display === 'flex' || DOM.detailsNew.style.display === 'flex')) {
        DOM.unsavedDialog.showModal();
        DOM.unsavedConfirmBtn.onclick = () => {
            DOM.unsavedDialog.close();
            resetFormDirty();
            callback();
            if (newPath || newQuery) updateUrl(newPath, newQuery);
        };
        DOM.unsavedCancelBtn.onclick = () => DOM.unsavedDialog.close();
    } else {
        callback();
        if (newPath || newQuery) updateUrl(newPath, newQuery);
    }
}

// Event Listeners - UI interactions
DOM.searchBtn.addEventListener('click', () => {
    currentPage = 1;
    loadContactList(DOM.searchInput.value);
    updateUrl('', `search=${encodeURIComponent(DOM.searchInput.value)}&page=${currentPage}&desc=${isDescending}`);
});
DOM.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        currentPage = 1;
        loadContactList(DOM.searchInput.value);
        updateUrl('', `search=${encodeURIComponent(DOM.searchInput.value)}&page=${currentPage}&desc=${isDescending}`);
    }
});
DOM.sortBtn.addEventListener('click', async () => {
    isDescending = !isDescending;
    DOM.sortBtn.setAttribute('aria-label', `Sort ${isDescending ? 'ascending' : 'descending'}`);
    DOM.sortBtn.querySelector('.sort-text').textContent = isDescending ? 'Desc' : 'Asc';
    DOM.sortBtn.querySelector('i').textContent = isDescending ? 'arrow_downward' : 'arrow_upward';
    if (currentContactId) {
        const response = await requestWrapper(
            signal => service.getContacts(pageCount, 1, DOM.searchInput.value, isDescending, signal),
            'Error sorting contacts'
        );
        if (response) {
            const data = response.data;
            const index = data.findIndex(c => c.id === currentContactId);
            currentPage = index >= 0 ? Math.ceil((index + 1) / pageCount) : 1;
        }
    }
    await loadContactList(DOM.searchInput.value);
    updateUrl('', `search=${encodeURIComponent(DOM.searchInput.value)}&page=${currentPage}&desc=${isDescending}`);
});
DOM.editBtn.addEventListener('click', () => currentContactId && confirmNavigation(() => showEditView(), `/${currentContactId}`));
DOM.detailsEdit.addEventListener('submit', (e) => e.preventDefault());
DOM.editSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveContact();
});
DOM.editCancelBtn.addEventListener('click', () => confirmNavigation(() => showViewMode(), currentContactId ? `/${currentContactId}` : ''));
DOM.editDeleteBtn.addEventListener('click', () => DOM.deleteDialog.showModal());
DOM.deleteConfirmBtn.addEventListener('click', () => {
    DOM.deleteDialog.close();
    deleteContact();
});
DOM.deleteCancelBtn.addEventListener('click', () => DOM.deleteDialog.close());
DOM.deleteDialog.addEventListener('click', (e) => e.target === DOM.deleteDialog && DOM.deleteDialog.close());
DOM.detailsNew.addEventListener('submit', (e) => e.preventDefault());
DOM.newSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    createNewContact();
});
DOM.newCancelBtn.addEventListener('click', () => confirmNavigation(() => {
    DOM.container.classList.remove('active');
    showNoneMode();
}, '/'));
DOM.backBtn.addEventListener('click', () => confirmNavigation(() => {
    DOM.container.classList.remove('active');
    showNoneMode();
    setTitle('home');
}, ''));
DOM.btnNew.addEventListener('click', () => confirmNavigation(() => showNewView(), '/new'));
DOM.btnPrev.addEventListener('click', () => changePage(currentPage - 1));
DOM.btnNext.addEventListener('click', () => changePage(currentPage + 1));
DOM.editAddEmailBtn.addEventListener('click', () => addEmailField(DOM.editEmailList));
DOM.newAddEmailBtn.addEventListener('click', () => addEmailField(DOM.newEmailList));
DOM.editAddPhoneBtn.addEventListener('click', () => addPhoneField(DOM.editPhoneList));
DOM.newAddPhoneBtn.addEventListener('click', () => addPhoneField(DOM.newPhoneList));
DOM.editAddAddressBtn.addEventListener('click', () => addAddressField(DOM.editAddressList));
DOM.newAddAddressBtn.addEventListener('click', () => addAddressField(DOM.newAddressList));
DOM.listNavigation.addEventListener('resize', () => updatePagination(totalPages));

// Form submit listeners
DOM.detailsNew.querySelectorAll('input').forEach((input) => addSubmitOnEnter(input));
DOM.detailsEdit.querySelectorAll('input').forEach((input) => addSubmitOnEnter(input));

// Validation and Dirty Setup - Adds validation and dirty tracking to forms
[DOM.detailsEdit, DOM.detailsNew].forEach(form => {
    form.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', markFormDirty);
        addValidationToTextField(el);
    });
});
[DOM.newBirthdate, DOM.editBirthdate].forEach(bd => bd.max = new Date().toISOString().split("T")[0]);

// Core Functions - Main app logic
async function loadContactList(query = '') {
    const response = await requestWrapper(
        signal => service.getContacts(pageCount, currentPage, query, isDescending, signal),
        'Error loading contacts'
    );
    DOM.listContent.innerHTML = '';
    let displayedCount = 0;
    if (response) {
        response.data.forEach(contact => {
            const li = document.createElement('li');
            li.className = `list-item${contact.id === currentContactId ? ' selected' : ''}`;
            li.dataset.id = contact.id;
            li.textContent = `${contact.firstName} ${contact.lastName}`;
            li.setAttribute('role', 'option');
            li.setAttribute('tabindex', '0');
            li.setAttribute('aria-selected', contact.id === currentContactId ? 'true' : 'false');
            li.addEventListener('click', () => confirmNavigation(() => showContactDetails(contact.id), `/${contact.id}`));
            addKeyboardClick(li);
            DOM.listContent.appendChild(li);
        });
        totalCount = response.meta.total;
        totalPages = Math.max(1, response.meta.totalPages);
        displayedCount = response.data.length;
        // Reset to page 1 if currentPage is invalid
        if (currentPage < 1 || currentPage > totalPages) {
            currentPage = 1;
            updateUrl('', `search=${encodeURIComponent(query)}&page=${currentPage}&desc=${isDescending}`);
            await loadContactList(query);
            return;
        }
    } else {
        totalCount = 0;
        totalPages = 1;
        // Reset to page 1 if no response
        if (currentPage !== 1) {
            currentPage = 1;
            updateUrl('', `search=${encodeURIComponent(query)}&page=${currentPage}&desc=${isDescending}`);
            await loadContactList(query);
            return;
        }
    }
    updatePagination(totalPages);
    updateResultSummary(displayedCount, totalCount);
}

function updateResultSummary(displayedCount, totalCount) {
    DOM.resultSummary.textContent = totalCount === 0 ? 'No items to show' :
        totalCount <= pageCount ? `Showing ${totalCount} of ${totalCount} results` :
            `Showing ${(currentPage - 1) * pageCount + 1}-${Math.min(currentPage * pageCount, totalCount)} of ${totalCount} items`;
}

async function showContactDetails(id) {
    if (window.innerWidth <= 750) {
        window.scrollTo(0, 0);
        DOM.container.classList.add('active');
    }
    const response = await requestWrapper(
        signal => service.getContact(id, signal),
        'Error loading contact details'
    );
    if (!response) {
        showNoneMode();
        updateUrl('');
        return;
    }
    const contact = response.data;
    currentContactId = id;

    setTitle('view', contact);

    DOM.viewName.textContent = `${contact.firstName} ${contact.lastName || ''}`;
    DOM.viewName.setAttribute('aria-label', `${contact.firstName} ${contact.lastName}`);
    if (contact.occupation) {
        DOM.viewOccupation.textContent = contact.occupation;
        DOM.viewOccupation.setAttribute('aria-label', contact.occupation);
        DOM.viewOccupation.style.display = 'block';
    } else {
        DOM.viewOccupation.textContent = '';
        DOM.viewOccupation.removeAttribute('aria-label');
        DOM.viewOccupation.style.display = 'none';
    }

    DOM.viewEmailList.innerHTML = '';
    (contact.emails || []).forEach((email, index) => {
        const li = document.createElement('li');
        li.className = 'input-list-item';
        li.innerHTML = `
            <div class="input-field outlined">
                <input id="view-email-${index}" type="text" value="${email}" readonly>
                <label for="view-email-${index}" class="active">Email</label>
            </div>
            <button class="btn-hover-input-list btn-input-list-copy" tabindex="0" title="Copy email" aria-label="Copy email"><i aria-hidden="true" class="material-icons">content_copy</i></button>
        `;
        li.querySelector('.btn-input-list-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(email);
            showSnackbar("Email copied");
        });
        DOM.viewEmailList.appendChild(li);
    });
    DOM.viewEmailContainer.classList.toggle('hidden', !contact.emails || contact.emails.length === 0);

    DOM.viewPhoneList.innerHTML = '';
    (contact.phoneNumbers || []).forEach((phone, index) => {
        const li = document.createElement('li');
        li.className = 'input-list-item';
        li.innerHTML = `
            <div class="input-field outlined">
                <input id="view-phone-${index}" type="text" value="${phone.number}" readonly>
                <label for="view-phone-${index}" class="active">${phone.type.charAt(0).toUpperCase() + phone.type.slice(1)}</label>
            </div>
            <button class="btn-hover-input-list btn-input-list-copy" tabindex="0" title="Copy phone number" aria-label="Copy phone number"><i aria-hidden="true" class="material-icons">content_copy</i></button>
        `;
        li.querySelector('.btn-input-list-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(phone.number);
            showSnackbar("Phone number copied");
        });
        DOM.viewPhoneList.appendChild(li);
    });
    DOM.viewPhoneContainer.classList.toggle('hidden', !contact.phoneNumbers || contact.phoneNumbers.length === 0);

    DOM.viewAddressList.innerHTML = '';
    (contact.addresses || []).forEach((address, index) => {
        const li = document.createElement('li');
        li.className = 'input-list-item';
        li.innerHTML = `
            <div class="input-field outlined">
                <input id="view-address-${index}" type="text" value="${address.address}" readonly>
                <label for="view-address-${index}" class="active">${address.type.charAt(0).toUpperCase() + address.type.slice(1)}</label>
            </div>
            <button class="btn-hover-input-list btn-input-list-copy" tabindex="0" title="Copy address" aria-label="Copy address"><i aria-hidden="true" class="material-icons">content_copy</i></button>
        `;
        li.querySelector('.btn-input-list-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(address.address);
            showSnackbar("Address copied");
        });
        DOM.viewAddressList.appendChild(li);
    });
    DOM.viewAddressContainer.classList.toggle('hidden', !contact.addresses || contact.addresses.length === 0);

    DOM.viewDetailsList.innerHTML = '';
    if (contact.birthdate) {
        const li = document.createElement('li');
        li.className = 'input-list-item';
        li.innerHTML = `
            <div class="input-field outlined">
                <input id="view-birthdate-0" type="text" value="${contact.birthdate}" readonly>
                <label for="view-birthdate-0" class="active">Birthdate</label>
            </div>
            <button class="btn-hover-input-list btn-input-list-copy" tabindex="0" title="Copy birthdate" aria-label="Copy birthdate"><i aria-hidden="true" class="material-icons">content_copy</i></button>
        `;
        li.querySelector('.btn-input-list-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(contact.birthdate);
            showSnackbar("Birthdate copied");
        });
        DOM.viewDetailsList.appendChild(li);
    }
    if (contact.notes) {
        const li = document.createElement('li');
        li.className = 'input-list-item';
        li.innerHTML = `
            <div class="input-field outlined">
                <input id="view-notes-0" type="text" value="${contact.notes}" readonly>
                <label for="view-notes-0" class="active">Notes</label>
            </div>
            <button class="btn-hover-input-list btn-input-list-copy" tabindex="0" title="Copy notes" aria-label="Copy notes"><i aria-hidden="true" class="material-icons">content_copy</i></button>
        `;
        li.querySelector('.btn-input-list-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(contact.notes);
            showSnackbar("Notes copied");
        });
        DOM.viewDetailsList.appendChild(li);
    }
    DOM.viewDetailsList.parentElement.classList.toggle('hidden', DOM.viewDetailsList.childElementCount === 0);

    showViewMode();
    DOM.viewName.focus();
    await loadContactList(DOM.searchInput.value);
}

async function saveContact() {
    const emailList = Array.from(DOM.editEmailList.querySelectorAll('input'));
    const phoneList = Array.from(DOM.editPhoneList.querySelectorAll('.input-list-item'));
    const addressList = Array.from(DOM.editAddressList.querySelectorAll('.input-list-item'));
    const validity = [
        refreshValidityTextField(DOM.editFirstName),
        refreshValidityTextField(DOM.editLastName),
        refreshValidityTextField(DOM.editBirthdate),
        refreshValidityTextField(DOM.editOccupation),
        emailList.map(e => refreshValidityTextField(e)).reduce((a, v) => a && v, true),
        phoneList.map(p => refreshValidityTextField(p.querySelector('input'))).reduce((a, v) => a && v, true),
        addressList.map(a => refreshValidityTextField(a.querySelector('input'))).reduce((a, v) => a && v, true),
        refreshValidityTextField(DOM.editNotes)
    ];

    if (!validity.reduce((a, v) => a && v, true)) {
        showSnackbar("Please correct all errors and try again.");
        return;
    }

    const contact = {
        id: currentContactId,
        firstName: DOM.editFirstName.value,
        lastName: DOM.editLastName.value || '',
        birthdate: DOM.editBirthdate.value || '',
        occupation: DOM.editOccupation.value || '',
        emails: emailList.map(input => input.value.trim()).filter(Boolean),
        phoneNumbers: phoneList.map(li => ({
            type: li.querySelector('.btn-phone-type').dataset.phoneType,
            number: li.querySelector('input').value.trim()
        })).filter(phone => phone.number),
        addresses: addressList.map(li => ({
            type: li.querySelector('.btn-address-type').dataset.addressType,
            address: li.querySelector('input').value.trim()
        })).filter(address => address.address),
        notes: DOM.editNotes.value || ''
    };
    const response = await requestWrapper(
        signal => service.upsertContact(contact, signal),
        'Error saving contact'
    );
    if (response) {
        resetFormDirty();
        await loadContactList();
        await showContactDetails(contact.id);
        updateUrl(`/${contact.id}`);
        showSnackbar('Contact updated successfully');
        DOM.btnNew.setAttribute('tabindex', '0');
    }
}

async function createNewContact() {
    const emailList = Array.from(DOM.newEmailList.querySelectorAll('input'));
    const phoneList = Array.from(DOM.newPhoneList.querySelectorAll('.input-list-item'));
    const addressList = Array.from(DOM.newAddressList.querySelectorAll('.input-list-item'));
    const validity = [
        refreshValidityTextField(DOM.newFirstName),
        refreshValidityTextField(DOM.newLastName),
        refreshValidityTextField(DOM.newBirthdate),
        refreshValidityTextField(DOM.newOccupation),
        emailList.map(e => refreshValidityTextField(e)).reduce((a, v) => a && v, true),
        phoneList.map(p => refreshValidityTextField(p.querySelector('input'))).reduce((a, v) => a && v, true),
        addressList.map(a => refreshValidityTextField(a.querySelector('input'))).reduce((a, v) => a && v, true),
        refreshValidityTextField(DOM.newNotes)
    ];

    if (!validity.reduce((a, v) => a && v, true)) {
        showSnackbar("Please correct all errors and try again.");
        return;
    }

    const contact = {
        id: 0,
        firstName: DOM.newFirstName.value,
        lastName: DOM.newLastName.value || '',
        birthdate: DOM.newBirthdate.value || '',
        occupation: DOM.newOccupation.value || '',
        emails: emailList.map(input => input.value.trim()).filter(Boolean),
        phoneNumbers: phoneList.map(li => ({
            type: li.querySelector('.btn-phone-type').dataset.phoneType,
            number: li.querySelector('input').value.trim()
        })).filter(phone => phone.number),
        addresses: addressList.map(li => ({
            type: li.querySelector('.btn-address-type').dataset.addressType,
            address: li.querySelector('input').value.trim()
        })).filter(address => address.address),
        notes: DOM.newNotes.value || ''
    };
    const response = await requestWrapper(
        signal => service.upsertContact(contact, signal),
        'Error creating contact'
    );
    if (response) {
        resetFormDirty();
        const newContact = response.data;
        await loadContactList(DOM.searchInput.value);
        await showContactDetails(newContact.id);
        updateUrl(`/${newContact.id}`);
        showSnackbar('Contact added successfully');
        DOM.btnNew.setAttribute('tabindex', '0');
    }
}

async function deleteContact() {
    const response = await requestWrapper(
        signal => service.deleteContact(currentContactId, signal),
        'Error deleting contact'
    );
    if (response) {
        await loadContactList();
        showNoneMode();
        if (window.innerWidth <= 750) DOM.container.classList.remove('active');
        updateUrl('');
        showSnackbar('Contact deleted successfully');
    }
}

// View Management Functions - Controls visibility of UI sections
function updatePagination(totalPages) {
    DOM.btnPrev.disabled = currentPage <= 1;
    DOM.btnNext.disabled = currentPage >= totalPages;
    const ul = DOM.listNavigation.querySelector("ul");
    const containerWidth = ul.offsetWidth - 30;
    const tempButton = document.createElement('button');
    tempButton.className = 'label-large';
    tempButton.textContent = '1';
    tempButton.style.position = 'absolute';
    tempButton.style.visibility = 'hidden';
    document.body.appendChild(tempButton);
    const buttonWidth = tempButton.offsetWidth + 8;
    document.body.removeChild(tempButton);
    const maxButtons = Math.floor(containerWidth / buttonWidth);
    ul.innerHTML = '';

    if (totalPages <= maxButtons) {
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `label-large ${currentPage === i ? 'selected' : ''}`;
            button.disabled = currentPage === i;
            button.textContent = i;
            button.setAttribute('tabindex', '0');
            button.setAttribute('aria-label', `Go to page ${i}`);
            button.addEventListener('click', () => changePage(i));
            li.appendChild(button);
            ul.appendChild(li);
        }
    } else {
        const halfWindow = Math.floor((maxButtons - 2) / 2);
        let startPage = Math.max(1, currentPage - halfWindow);
        let endPage = Math.min(totalPages, startPage + maxButtons - 3);
        if (endPage === totalPages) startPage = Math.max(1, endPage - maxButtons + 3);

        if (startPage > 2) {
            const liFirst = document.createElement('li');
            const btnFirst = document.createElement('button');
            btnFirst.type = 'button';
            btnFirst.className = `label-large ${currentPage === 1 ? 'selected' : ''}`;
            btnFirst.textContent = '1';
            btnFirst.setAttribute('tabindex', '0');
            btnFirst.setAttribute('aria-label', 'Go to page 1');
            btnFirst.addEventListener('click', () => changePage(1));
            liFirst.appendChild(btnFirst);
            ul.appendChild(liFirst);

            const liEllipsis1 = document.createElement('li');
            const btnEllipsis1 = document.createElement('button');
            btnEllipsis1.type = 'button';
            btnEllipsis1.className = 'label-large';
            btnEllipsis1.textContent = '...';
            btnEllipsis1.disabled = true;
            btnEllipsis1.setAttribute('tabindex', '-1');
            liEllipsis1.appendChild(btnEllipsis1);
            ul.appendChild(liEllipsis1);
        } else if (startPage === 2) {
            const liFirst = document.createElement('li');
            const btnFirst = document.createElement('button');
            btnFirst.type = 'button';
            btnFirst.className = `label-large ${currentPage === 1 ? 'selected' : ''}`;
            btnFirst.textContent = '1';
            btnFirst.setAttribute('tabindex', '0');
            btnFirst.setAttribute('aria-label', 'Go to page 1');
            btnFirst.addEventListener('click', () => changePage(1));
            liFirst.appendChild(btnFirst);
            ul.appendChild(liFirst);
        }

        for (let i = startPage; i <= endPage; i++) {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `label-large ${currentPage === i ? 'selected' : ''}`;
            button.textContent = i;
            button.setAttribute('tabindex', '0');
            button.setAttribute('aria-label', `Go to page ${i}`);
            button.addEventListener('click', () => changePage(i));
            li.appendChild(button);
            ul.appendChild(li);
        }

        if (endPage < totalPages - 1) {
            const liEllipsis2 = document.createElement('li');
            const btnEllipsis2 = document.createElement('button');
            btnEllipsis2.type = 'button';
            btnEllipsis2.className = 'label-large';
            btnEllipsis2.textContent = '...';
            btnEllipsis2.disabled = true;
            btnEllipsis2.setAttribute('tabindex', '-1');
            liEllipsis2.appendChild(btnEllipsis2);
            ul.appendChild(liEllipsis2);

            const liLast = document.createElement('li');
            const btnLast = document.createElement('button');
            btnLast.type = 'button';
            btnLast.className = `label-large ${currentPage === totalPages ? 'selected' : ''}`;
            btnLast.textContent = totalPages;
            btnLast.setAttribute('tabindex', '0');
            btnLast.setAttribute('aria-label', `Go to page ${totalPages}`);
            btnLast.addEventListener('click', () => changePage(totalPages));
            liLast.appendChild(btnLast);
            ul.appendChild(liLast);
        } else if (endPage === totalPages - 1) {
            const liLast = document.createElement('li');
            const btnLast = document.createElement('button');
            btnLast.type = 'button';
            btnLast.className = `label-large ${currentPage === totalPages ? 'selected' : ''}`;
            btnLast.textContent = totalPages;
            btnLast.setAttribute('tabindex', '0');
            btnLast.setAttribute('aria-label', `Go to page ${totalPages}`);
            btnLast.addEventListener('click', () => changePage(totalPages));
            liLast.appendChild(btnLast);
            ul.appendChild(liLast);
        }
    }
}

function changePage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        loadContactList(DOM.searchInput.value);
        updateUrl('', `search=${encodeURIComponent(DOM.searchInput.value)}&page=${currentPage}&desc=${isDescending}`);
    }
}

function showViewMode() {

    DOM.detailsNone.style.display = 'none';
    DOM.detailsNone.setAttribute('aria-hidden', 'true');
    DOM.detailsView.style.display = 'flex';
    DOM.detailsView.setAttribute('aria-hidden', 'false');
    DOM.detailsEdit.style.display = 'none';
    DOM.detailsEdit.setAttribute('aria-hidden', 'true');
    DOM.detailsNew.style.display = 'none';
    DOM.detailsNew.setAttribute('aria-hidden', 'true');
    DOM.editBtn.setAttribute('tabindex', '0');
    DOM.btnNew.setAttribute('tabindex', '0');

}

async function showEditView() {
    const response = await requestWrapper(
        signal => service.getContact(currentContactId, signal),
        'Error loading contact for edit'
    );
    if (!response) return;
    const contact = response.data;

    setTitle('edit', contact);

    destroyDropdownInstances(DOM.editPhoneList);
    destroyDropdownInstances(DOM.editAddressList);
    destroyCharacterCounters(DOM.editEmailList);
    destroyCharacterCounters(DOM.editPhoneList);
    destroyCharacterCounters(DOM.editAddressList);

    DOM.editFirstName.value = contact.firstName;
    DOM.editLastName.value = contact.lastName || '';
    DOM.editBirthdate.value = contact.birthdate || '';
    DOM.editOccupation.value = contact.occupation || '';
    DOM.editEmailList.innerHTML = '';
    (contact.emails || []).forEach(email => addEmailField(DOM.editEmailList, email));
    DOM.editPhoneList.innerHTML = '';
    (contact.phoneNumbers || []).forEach(phone => addPhoneField(DOM.editPhoneList, phone.number, phone.type));
    DOM.editAddressList.innerHTML = '';
    (contact.addresses || []).forEach(address => addAddressField(DOM.editAddressList, address.address, address.type));
    DOM.editNotes.value = contact.notes || '';
    DOM.detailsNone.style.display = 'none';
    DOM.detailsNone.setAttribute('aria-hidden', 'true');
    DOM.detailsView.style.display = 'none';
    DOM.detailsView.setAttribute('aria-hidden', 'true');
    DOM.detailsEdit.style.display = 'flex';
    DOM.detailsEdit.setAttribute('aria-hidden', 'false');
    DOM.detailsNew.style.display = 'none';
    DOM.detailsNew.setAttribute('aria-hidden', 'true');
    DOM.editBtn.setAttribute('tabindex', '0');
    DOM.btnNew.setAttribute('tabindex', '-1');
    if (window.innerWidth <= 750) DOM.container.classList.add('active');
    resetFormDirty();
}

function showNewView() {
    destroyDropdownInstances(DOM.newPhoneList);
    destroyDropdownInstances(DOM.newAddressList);
    destroyCharacterCounters(DOM.newEmailList);
    destroyCharacterCounters(DOM.newPhoneList);
    destroyCharacterCounters(DOM.newAddressList);

    DOM.newFirstName.value = '';
    DOM.newLastName.value = '';
    DOM.newBirthdate.value = '';
    DOM.newOccupation.value = '';
    DOM.newEmailList.innerHTML = '';
    DOM.newPhoneList.innerHTML = '';
    DOM.newAddressList.innerHTML = '';
    DOM.newNotes.value = '';
    DOM.detailsNone.style.display = 'none';
    DOM.detailsNone.setAttribute('aria-hidden', 'true');
    DOM.detailsView.style.display = 'none';
    DOM.detailsView.setAttribute('aria-hidden', 'true');
    DOM.detailsEdit.style.display = 'none';
    DOM.detailsEdit.setAttribute('aria-hidden', 'true');
    DOM.detailsNew.style.display = 'flex';
    DOM.detailsNew.setAttribute('aria-hidden', 'false');
    if (window.innerWidth <= 750) DOM.container.classList.add('active');
    DOM.editBtn.setAttribute('tabindex', '-1');
    DOM.btnNew.setAttribute('tabindex', '0');
    DOM.newFirstName.focus();
    resetFormDirty();
}

function showNoneMode() {
    destroyDropdownInstances(DOM.editPhoneList);
    destroyDropdownInstances(DOM.editAddressList);
    destroyDropdownInstances(DOM.newPhoneList);
    destroyDropdownInstances(DOM.newAddressList);
    destroyCharacterCounters(DOM.editEmailList);
    destroyCharacterCounters(DOM.editPhoneList);
    destroyCharacterCounters(DOM.editAddressList);
    destroyCharacterCounters(DOM.newEmailList);
    destroyCharacterCounters(DOM.newPhoneList);
    destroyCharacterCounters(DOM.newAddressList);

    DOM.detailsNone.style.display = 'flex';
    DOM.detailsNone.setAttribute('aria-hidden', 'false');
    DOM.detailsView.style.display = 'none';
    DOM.detailsView.setAttribute('aria-hidden', 'true');
    DOM.detailsEdit.style.display = 'none';
    DOM.detailsEdit.setAttribute('aria-hidden', 'true');
    DOM.detailsNew.style.display = 'none';
    DOM.detailsNew.setAttribute('aria-hidden', 'true');
    currentContactId = null;
    loadContactList(DOM.searchInput.value);
    DOM.editBtn.setAttribute('tabindex', '-1');
    DOM.btnNew.setAttribute('tabindex', '0');
}

// Input Field Functions - Dynamic form field management
function addEmailField(list, value = '') {
    if (list.lastElementChild && list.lastElementChild.querySelector('input').value === '') {
        list.lastElementChild.querySelector('input').focus();
        return;
    }
    const li = document.createElement('li');
    li.className = 'input-list-item';
    li.innerHTML = `
        <div class="input-field outlined">
            <input type="email" value="${value}" placeholder="Enter email" aria-label="Enter email" maxlength="50">
            <p class="supporting-text error">Invalid email</p>
        </div>
        <button type="button" class="btn-hover-input-list btn-input-list-delete" title="Delete" aria-label="Delete email"><i aria-hidden="true" class="material-icons">delete</i></button>
    `;
    const input = li.querySelector('input');
    li.querySelector('button').addEventListener('click', () => {
        destroyCharacterCounter(input);
        li.remove();
    });
    addValidationToTextField(input);
    input.addEventListener('input', markFormDirty);
    M.CharacterCounter.init(input);
    list.appendChild(li);
    input.focus();
}

function addPhoneField(list, value = '', type = 'personal') {
    if (list.lastElementChild && list.lastElementChild.querySelector('input').value === '') {
        list.lastElementChild.querySelector('input').focus();
        return;
    }
    const listLength = list.childElementCount;
    const dropdownListName = `dropdown-phone-type-${listLength}`;
    const btnDropdownName = `btn-phone-type-${listLength}`;
    const li = document.createElement('li');
    li.className = 'input-list-item';
    li.innerHTML = `
        <div class="input-field outlined">
            <button class="dropdown-trigger btn-small outlined waves-effect waves-light btn-phone-type" id="${btnDropdownName}" data-target="${dropdownListName}" data-phone-type="${type}" title="Choose phone type" aria-label="Choose phone type" aria-expanded="false">${type.charAt(0).toUpperCase() + type.slice(1)}</button>
            <ul id="${dropdownListName}" class="dropdown-content">
                <li data-phone-type="personal" tabindex="0" role="option">Personal</li>
                <li data-phone-type="work" tabindex="0" role="option">Work</li>
                <li data-phone-type="home" tabindex="0" role="option">Home</li>
            </ul>
            <input type="tel" value="${value}" placeholder="Enter phone" aria-label="Phone number" pattern="[A-Za-z0-9\\s\\-\\.\\(\\)\\+]+" maxlength="50">
            <p class="supporting-text error">Invalid characters</p>
        </div>
        <button type="button" class="btn-hover-input-list btn-input-list-delete" title="Delete" aria-label="Delete phone"><i aria-hidden="true" class="material-icons">delete</i></button>
    `;
    list.appendChild(li);

    const btnDropdown = li.querySelector(`#${btnDropdownName}`);
    const dropdownInstance = M.Dropdown.init(btnDropdown, {
        constrainWidth: false,
        coverTrigger: false,
        onOpenStart: () => btnDropdown.setAttribute('aria-expanded', 'true'),
        onCloseEnd: () => btnDropdown.setAttribute('aria-expanded', 'false')
    });

    const input = li.querySelector('input');
    li.querySelector('.btn-input-list-delete').addEventListener('click', () => {
        if (dropdownInstance) dropdownInstance.destroy();
        destroyCharacterCounter(input);
        li.remove();
    });

    const dropdownItems = li.querySelectorAll(`#${dropdownListName} li`);
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedType = item.dataset.phoneType;
            if (selectedType) {
                btnDropdown.setAttribute('data-phone-type', selectedType);
                btnDropdown.textContent = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);
                if (dropdownInstance) dropdownInstance.close();
                input.focus();
            }
        });
        addKeyboardClick(item);
    });

    addValidationToTextField(input);
    input.addEventListener('input', markFormDirty);
    M.CharacterCounter.init(input);
    addSubmitOnEnter(input);
    input.focus();
}

function addAddressField(list, value = '', type = 'home') {
    if (list.lastElementChild && list.lastElementChild.querySelector('input').value === '') {
        list.lastElementChild.querySelector('input').focus();
        return;
    }
    const listLength = list.childElementCount;
    const dropdownListName = `dropdown-address-type-${listLength}`;
    const btnDropdownName = `btn-address-type-${listLength}`;
    const li = document.createElement('li');
    li.className = 'input-list-item';
    li.innerHTML = `
        <div class="input-field outlined">
            <button class="dropdown-trigger btn-small outlined waves-effect waves-light btn-address-type" id="${btnDropdownName}" data-target="${dropdownListName}" data-address-type="${type}" title="Choose address type" aria-label="Choose address type" aria-expanded="false">${type.charAt(0).toUpperCase() + type.slice(1)}</button>
            <ul id="${dropdownListName}" class="dropdown-content">
                <li data-address-type="home" tabindex="0" role="option">Home</li>
                <li data-address-type="work" tabindex="0" role="option">Work</li>
            </ul>
            <input type="text" value="${value}" placeholder="Enter address" aria-label="Address" pattern="[A-Za-z0-9\\s\\-\\.\\(\\)\\+\\,]+" maxlength="100">
            <p class="supporting-text error">Invalid characters</p>
        </div>
        <button type="button" class="btn-hover-input-list btn-input-list-delete" title="Delete" aria-label="Delete address"><i aria-hidden="true" class="material-icons">delete</i></button>
    `;
    list.appendChild(li);

    const btnDropdown = li.querySelector(`#${btnDropdownName}`);
    const dropdownInstance = M.Dropdown.init(btnDropdown, {
        constrainWidth: false,
        coverTrigger: false,
        onOpenStart: () => btnDropdown.setAttribute('aria-expanded', 'true'),
        onCloseEnd: () => btnDropdown.setAttribute('aria-expanded', 'false')
    });

    const input = li.querySelector('input');
    li.querySelector('.btn-input-list-delete').addEventListener('click', () => {
        if (dropdownInstance) dropdownInstance.destroy();
        destroyCharacterCounter(input);
        li.remove();
    });

    const dropdownItems = li.querySelectorAll(`#${dropdownListName} li`);
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedType = item.dataset.addressType;
            if (selectedType) {
                btnDropdown.setAttribute('data-address-type', selectedType);
                btnDropdown.textContent = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);
                if (dropdownInstance) dropdownInstance.close();
                input.focus();
            }
        });
        addKeyboardClick(item);
    });

    addValidationToTextField(input);
    input.addEventListener('input', markFormDirty);
    M.CharacterCounter.init(input);
    addSubmitOnEnter(input);
    input.focus();
}

// Utility Functions
function showSnackbar(message) {
    DOM.snackbar.textContent = message;
    DOM.snackbar.classList.add('show');
    setTimeout(() => DOM.snackbar.classList.remove('show'), 3000);
}

function showLoading() {
    DOM.loadingBar.style.display = 'block';
}

function hideLoading() {
    DOM.loadingBar.style.display = 'none';
}

function updateUrl(path, query = '') {
    const normalizedPath = `${CLIENT_BASE_PATH}${path}`.replace(/\/+$/, ''); // Remove trailing slashes
    const newUrl = query ? `${normalizedPath}?${query}` : normalizedPath;
    window.history.pushState({}, document.title, newUrl);
    setPageTitle(path, query);
}

async function parseInitialUrl() {
    const path = window.location.pathname.replace(CLIENT_BASE_PATH, '');
    const query = new URLSearchParams(window.location.search);

    setPageTitle(path, window.location.search);

    if (path === '' || path === '/') {
        if (query.has('search')) {
            DOM.searchInput.value = query.get('search') || '';
            currentPage = parseInt(query.get('page') || '1', 10);
            isDescending = query.get('desc') === 'true';
            DOM.sortBtn.setAttribute('aria-label', `Sort ${isDescending ? 'ascending' : 'descending'}`);
            DOM.sortBtn.querySelector('.sort-text').textContent = isDescending ? 'Desc' : 'Asc';
            DOM.sortBtn.querySelector('i').textContent = isDescending ? 'arrow_downward' : 'arrow_upward';
            await loadContactList(DOM.searchInput.value);
        } else {
            showNoneMode();
        }
    } else if (/^\/\d+$/.test(path)) {
        const id = parseInt(path.slice(1), 10);
        await showContactDetails(id);
    } else if (path === '/new') {
        showNewView();
    } else {
        showNoneMode();
        showSnackbar('Invalid URL path');
    }
}

function setTitle(viewMode, contact = null, isSearch = false) {
    if (isSearch) {
        document.title = `Search - ${TITLE_BASE}`;
    } else if (viewMode === 'new') {
        document.title = `New - ${TITLE_BASE}`;
    } else if (viewMode === 'view' || viewMode === 'edit') {
        if (contact && contact.firstName && contact.lastName) {
            document.title = `${contact.firstName} ${contact.lastName} - ${TITLE_BASE}`;
        } else if (DOM.viewName.textContent && viewMode === 'view') {
            document.title = `${DOM.viewName.textContent} - ${TITLE_BASE}`;
        } else if (DOM.editFirstName.value && DOM.editLastName.value && viewMode === 'edit') {
            document.title = `${DOM.editFirstName.value.trim()} ${DOM.editLastName.value.trim()} - ${TITLE_BASE}`;
        } else {
            document.title = TITLE_BASE;  // Fallback if no contact data
        }
    } else {
        document.title = TITLE_BASE;  // Home or not found
    }
}

function setPageTitle(path, query = '') {
    const isSearch = query && query.includes('search=');
    if (path === '' || path === '/') {
        setTitle('home', null, isSearch);
    } else if (path === '/new') {
        setTitle('new');
    } else if (/^\/\d+$/.test(path)) {
        // Defer to showContactDetails or showEditView for contact name
        setTitle(DOM.detailsEdit.style.display === 'flex' ? 'edit' : 'view');
    } else {
        setTitle('notfound');
    }
}

// Validation Functions - Form input validation
function validationOnFocusOut(element, valFunc) {
    element.addEventListener("focusout", (e) => {
        if (valFunc(e.target)) {
            element.parentElement.classList.remove("error");
        } else {
            element.parentElement.classList.add("error");
        }
    });
}

function cleanInputValue(e) {
    let value = e.value;
    value = value.trim().replace(/[\n\t\r\u00A0]+/g, ' ').replace(/\s+/g, ' ');
    e.value = value;
}

function addValidationToTextField(inputElement) {
    validationOnFocusOut(inputElement, (t) => {
        cleanInputValue(t);
        return t.checkValidity();
    });
    inputElement.addEventListener('invalid', (e) => {
        e.preventDefault();
        inputElement.parentElement.classList.add("error");
    });
    inputElement.addEventListener('input', () => {
        if (inputElement.checkValidity()) inputElement.parentElement.classList.remove("error");
    });
}

function refreshValidityTextField(element) {
    cleanInputValue(element);
    if (element.checkValidity()) {
        element.parentElement.classList.remove("error");
        return true;
    } else {
        element.parentElement.classList.add("error");
        return false;
    }
}

// Cleanup Functions - Destroys UI component instances
function destroyDropdownInstances(list) {
    const dropdowns = list.querySelectorAll('.dropdown-trigger');
    dropdowns.forEach(dropdown => {
        const instance = M.Dropdown.getInstance(dropdown);
        if (instance) instance.destroy();
    });
}

function destroyCharacterCounter(element) {
    const instance = M.CharacterCounter.getInstance(element);
    if (instance) instance.destroy();
}

function destroyCharacterCounters(list) {
    const inputs = list.querySelectorAll('input, textarea');
    inputs.forEach(input => destroyCharacterCounter(input));
}

// Accessibility Functions - Enhances keyboard navigation
function addKeyboardClick(element) {
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            element.click();
        }
    });
}

function addSubmitOnEnter(element) {
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.closest('form').querySelector('button[type=submit]').click();
        }
    });
}

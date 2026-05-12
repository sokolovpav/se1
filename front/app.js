const API_URL = 'http://localhost:3000/api';

let currentToken = localStorage.getItem('token');
let currentUser = null;
let currentListId = null;

// Проверяем токен при загрузке страницы
if (currentToken) {
    // Восстанавливаем пользователя из токена
    try {
        const tokenData = JSON.parse(atob(currentToken.split('.')[1]));
        currentUser = { id: tokenData.id, email: tokenData.email };
        showMainApp();
        loadLists();
    } catch (error) {
        console.error('Invalid token:', error);
        logout();
    }
}

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        logout();
        throw new Error('Session expired');
    }
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    
    return data;
}

// Auth functions
async function register(email, password) {
    try {
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', currentToken);
        showMainApp();
        loadLists();
    } catch (error) {
        document.getElementById('registerError').textContent = error.message;
    }
}

async function login(email, password) {
    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', currentToken);
        showMainApp();
        loadLists();
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
    }
}

function logout() {
    currentToken = null;
    currentUser = null;
    currentListId = null;
    localStorage.removeItem('token');
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('authSection').style.display = 'flex';
    // Очищаем форму входа
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
}

// List functions
async function loadLists() {
    try {
        const data = await apiCall('/lists');
        displayLists(data.ownedLists, data.sharedLists);
    } catch (error) {
        console.error('Failed to load lists:', error);
    }
}

function displayLists(ownedLists, sharedLists) {
    const ownedContainer = document.getElementById('ownedLists');
    const sharedContainer = document.getElementById('sharedLists');
    
    ownedContainer.innerHTML = '';
    sharedContainer.innerHTML = '';
    
    ownedLists.forEach(list => {
        const listElement = createListElement(list, 'owner');
        ownedContainer.appendChild(listElement);
    });
    
    sharedLists.forEach(list => {
        const listElement = createListElement(list, 'shared');
        sharedContainer.appendChild(listElement);
    });
}

function createListElement(list, role) {
    const div = document.createElement('div');
    div.className = `list-item ${currentListId === list.id ? 'active' : ''}`;
    div.onclick = (e) => {
        if (!e.target.classList.contains('edit-list-btn') && 
            !e.target.classList.contains('delete-list-btn')) {
            selectList(list.id);
        }
    };
    
    div.innerHTML = `
        <div class="list-name">${escapeHtml(list.name)}</div>
        <div class="list-owner">Автор: ${escapeHtml(list.owner_email)}</div>
        <div class="list-actions">
            ${role === 'owner' ? `
                <button class="edit-list-btn" onclick="editList(${list.id}, '${escapeHtml(list.name)}')">✏️</button>
                <button class="delete-list-btn" onclick="deleteList(${list.id})">🗑️</button>
            ` : ''}
        </div>
    `;
    
    return div;
}

window.editList = async function(listId, currentName) {
    const newName = prompt('Введите новое название списка:', currentName);
    if (newName && newName !== currentName) {
        try {
            await apiCall(`/lists/${listId}`, {
                method: 'PUT',
                body: JSON.stringify({ name: newName })
            });
            await loadLists();
            if (currentListId === listId) {
                await loadListItems(listId);
            }
        } catch (error) {
            alert('Ошибка при редактировании списка: ' + error.message);
        }
    }
};

window.deleteList = async function(listId) {
    if (confirm('Вы уверены, что хотите удалить этот список?')) {
        try {
            await apiCall(`/lists/${listId}`, { method: 'DELETE' });
            if (currentListId === listId) {
                currentListId = null;
                document.getElementById('selectedListInfo').innerHTML = '';
                document.getElementById('listItems').innerHTML = '';
                document.getElementById('shareSection').style.display = 'none';
            }
            await loadLists();
        } catch (error) {
            alert('Ошибка при удалении списка: ' + error.message);
        }
    }
};

async function createList(name) {
    try {
        await apiCall('/lists', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        await loadLists();
        document.getElementById('newListName').value = '';
    } catch (error) {
        alert('Ошибка при создании списка: ' + error.message);
    }
}

async function selectList(listId) {
    currentListId = listId;
    await loadListItems(listId);
    await loadSharedUsers(listId);
    
    // Highlight selected list
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and highlight the selected list
    const listItems = document.querySelectorAll('.list-item');
    for (let item of listItems) {
        const onclickStr = item.getAttribute('onclick');
        if (onclickStr && onclickStr.includes(`selectList(${listId})`)) {
            item.classList.add('active');
            break;
        }
    }
    
    // Show share section for owners
    const list = await getListInfo(listId);
    if (list && list.role === 'owner') {
        document.getElementById('shareSection').style.display = 'block';
    } else {
        document.getElementById('shareSection').style.display = 'none';
    }
}

async function getListInfo(listId) {
    const data = await apiCall('/lists');
    const allLists = [...data.ownedLists, ...data.sharedLists];
    return allLists.find(l => l.id === listId);
}

// Items functions
async function loadListItems(listId) {
    try {
        const items = await apiCall(`/lists/${listId}/items`);
        displayItems(items);
        
        const listInfo = await getListInfo(listId);
        document.getElementById('selectedListInfo').innerHTML = `
            <h2>${escapeHtml(listInfo.name)}</h2>
            <p>Автор: ${escapeHtml(listInfo.owner_email)}</p>
        `;
    } catch (error) {
        console.error('Failed to load items:', error);
    }
}

function displayItems(items) {
    const container = document.getElementById('listItems');
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">Список пуст. Добавьте продукты!</p>';
        return;
    }
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `item-row ${item.is_purchased ? 'purchased' : ''}`;
        itemDiv.innerHTML = `
            <input type="checkbox" class="item-checkbox" ${item.is_purchased ? 'checked' : ''} 
                   onchange="togglePurchased(${item.id}, this.checked)">
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-quantity">${escapeHtml(item.quantity)}</span>
            <div class="item-actions">
                <button class="edit-item-btn" onclick="editItem(${item.id}, '${escapeHtml(item.name)}', '${escapeHtml(item.quantity)}')">✏️</button>
                <button class="delete-item-btn" onclick="deleteItem(${item.id})">🗑️</button>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

window.togglePurchased = async function(itemId, isPurchased) {
    try {
        await apiCall(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_purchased: isPurchased ? 1 : 0 })
        });
        await loadListItems(currentListId);
    } catch (error) {
        alert('Ошибка при обновлении статуса: ' + error.message);
    }
};

// Обновленная функция editItem с возможностью редактирования количества
window.editItem = async function(itemId, currentName, currentQuantity) {
    // Создаем диалоговое окно с двумя полями
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        width: 400px;
        max-width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;
    
    dialog.innerHTML = `
        <h3 style="margin-bottom: 20px;">Редактировать продукт</h3>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Название:</label>
            <input type="text" id="editItemName" value="${escapeHtml(currentName)}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
        </div>
        <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Количество:</label>
            <input type="text" id="editItemQuantity" value="${escapeHtml(currentQuantity)}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px;">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelEditBtn" style="padding: 8px 16px; background: #718096; color: white; border: none; border-radius: 5px; cursor: pointer;">Отмена</button>
            <button id="saveEditBtn" style="padding: 8px 16px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer;">Сохранить</button>
        </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    const nameInput = dialog.querySelector('#editItemName');
    const quantityInput = dialog.querySelector('#editItemQuantity');
    
    const saveBtn = dialog.querySelector('#saveEditBtn');
    const cancelBtn = dialog.querySelector('#cancelEditBtn');
    
    const saveChanges = async () => {
        const newName = nameInput.value.trim();
        const newQuantity = quantityInput.value.trim();
        
        if (!newName) {
            alert('Название не может быть пустым');
            return;
        }
        
        try {
            // Обновляем и название, и количество
            await apiCall(`/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    name: newName,
                    quantity: newQuantity || '1'
                })
            });
            await loadListItems(currentListId);
            modal.remove();
        } catch (error) {
            alert('Ошибка при редактировании: ' + error.message);
        }
    };
    
    saveBtn.onclick = saveChanges;
    cancelBtn.onclick = () => modal.remove();
    
    // Закрытие по клику вне диалога
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    // Обработка нажатия Enter
    nameInput.onkeypress = (e) => {
        if (e.key === 'Enter') saveChanges();
    };
    quantityInput.onkeypress = (e) => {
        if (e.key === 'Enter') saveChanges();
    };
    
    nameInput.focus();
};

window.deleteItem = async function(itemId) {
    if (confirm('Вы уверены, что хотите удалить этот продукт?')) {
        try {
            await apiCall(`/items/${itemId}`, { method: 'DELETE' });
            await loadListItems(currentListId);
        } catch (error) {
            alert('Ошибка при удалении: ' + error.message);
        }
    }
};

async function addItem(name, quantity) {
    if (!name.trim()) {
        alert('Введите название продукта');
        return;
    }
    
    try {
        await apiCall('/items', {
            method: 'POST',
            body: JSON.stringify({
                shopping_list_id: currentListId,
                name: name.trim(),
                quantity: quantity.trim() || '1'
            })
        });
        await loadListItems(currentListId);
        document.getElementById('newItemName').value = '';
        document.getElementById('newItemQuantity').value = '1';
    } catch (error) {
        alert('Ошибка при добавлении продукта: ' + error.message);
    }
}

// Share functions
async function shareList(email, canEdit) {
    if (!email.trim()) {
        alert('Введите email пользователя');
        return;
    }
    
    try {
        await apiCall('/share', {
            method: 'POST',
            body: JSON.stringify({
                shopping_list_id: currentListId,
                email: email.trim(),
                can_edit: canEdit ? 1 : 0
            })
        });
        await loadSharedUsers(currentListId);
        document.getElementById('shareEmail').value = '';
        document.getElementById('shareCanEdit').checked = false;
        alert('Список успешно поделен!');
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function loadSharedUsers(listId) {
    try {
        const users = await apiCall(`/share/${listId}`);
        displaySharedUsers(users);
    } catch (error) {
        console.error('Failed to load shared users:', error);
    }
}

function displaySharedUsers(users) {
    const container = document.getElementById('sharedUsersList');
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<p style="color: #718096;">Список ни с кем не поделен</p>';
        return;
    }
    
    users.forEach(share => {
        const div = document.createElement('div');
        div.className = 'shared-user-item';
        div.innerHTML = `
            <span>${escapeHtml(share.email)} ${share.can_edit ? '(может редактировать)' : '(только просмотр)'}</span>
            <button class="remove-share-btn" onclick="removeShare(${share.shared_with_user_id})">Удалить доступ</button>
        `;
        container.appendChild(div);
    });
}

window.removeShare = async function(userId) {
    if (confirm('Удалить доступ пользователя к этому списку?')) {
        try {
            await apiCall(`/share/${currentListId}/${userId}`, { method: 'DELETE' });
            await loadSharedUsers(currentListId);
            alert('Доступ удален');
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }
};

// UI helpers
function showMainApp() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userEmail').textContent = currentUser.email;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.getElementById('loginBtn').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    login(email, password);
});

document.getElementById('registerBtn').addEventListener('click', () => {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    register(email, password);
});

document.getElementById('logoutBtn').addEventListener('click', logout);

document.getElementById('createListBtn').addEventListener('click', () => {
    const name = document.getElementById('newListName').value;
    if (name) createList(name);
});

document.getElementById('addItemBtn').addEventListener('click', () => {
    const name = document.getElementById('newItemName').value;
    const quantity = document.getElementById('newItemQuantity').value;
    addItem(name, quantity);
});

document.getElementById('shareBtn').addEventListener('click', () => {
    const email = document.getElementById('shareEmail').value;
    const canEdit = document.getElementById('shareCanEdit').checked;
    shareList(email, canEdit);
});

// Добавляем обработчик Enter для полей ввода
document.getElementById('newItemName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = document.getElementById('newItemName').value;
        const quantity = document.getElementById('newItemQuantity').value;
        addItem(name, quantity);
    }
});

document.getElementById('newItemQuantity').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = document.getElementById('newItemName').value;
        const quantity = document.getElementById('newItemQuantity').value;
        addItem(name, quantity);
    }
});

document.getElementById('newListName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const name = document.getElementById('newListName').value;
        if (name) createList(name);
    }
});

document.getElementById('shareEmail').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const email = document.getElementById('shareEmail').value;
        const canEdit = document.getElementById('shareCanEdit').checked;
        shareList(email, canEdit);
    }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.getElementById(`${tab}Form`).classList.add('active');
        // Очищаем ошибки при переключении вкладок
        document.getElementById('loginError').textContent = '';
        document.getElementById('registerError').textContent = '';
    });
});
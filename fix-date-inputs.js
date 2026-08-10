const fs = require('fs');

try {
    let createCode = fs.readFileSync('views/create.ejs', 'utf8');
    createCode = createCode.replace(
        '<input type="date" name="activityDate" class="form-input" required>',
        '<input type="text" name="activityDate" class="form-input" placeholder="Etkinlik Tarihi" onfocus="(this.type=\'date\')" onblur="(if(!this.value){this.type=\'text\'})" required>'
    );
    fs.writeFileSync('views/create.ejs', createCode);

    let addCode = fs.readFileSync('views/add-expense.ejs', 'utf8');
    addCode = addCode.replace(
        '<input type="date" name="date" class="form-input" id="expenseDate" required>',
        '<input type="text" name="date" class="form-input" id="expenseDate" placeholder="Harcama Tarihi" onfocus="(this.type=\'date\')" onblur="(if(!this.value){this.type=\'text\'})" required>'
    );
    addCode = addCode.replace(
        '<input type="date" id="expenseDate" name="date" required>',
        '<input type="text" id="expenseDate" name="date" placeholder="Harcama Tarihi" onfocus="(this.type=\'date\')" onblur="(if(!this.value){this.type=\'text\'})" required>'
    );
    fs.writeFileSync('views/add-expense.ejs', addCode);

    console.log('Successfully fixed date inputs in create.ejs and add-expense.ejs');
} catch (e) {
    console.error(e);
}

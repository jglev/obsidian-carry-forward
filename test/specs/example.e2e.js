describe('My Login application', () => {
    // it('should login with valid credentials', async () => {
    //     await browser.url(`https://the-internet.herokuapp.com/login`);

    //     await $('#username').setValue('tomsmith');
    //     await $('#password').setValue('SuperSecretPassword!');
    //     await $('button[type="submit"]').click();

    //     await expect($('#flash')).toBeExisting();
    //     await expect($('#flash')).toHaveTextContaining(
    //         'You logged into a secure area!');
    // });

    it('should open', async () => {
        await browser;

        // await $('.setting-item-control').click();

        await browser.execute(
            "require('electron').ipcRenderer.sendSync('vaultOpen', 'test/empty_vault', false)"
        );

        // await $('#username').setValue('tomsmith');
        // await $('#password').setValue('SuperSecretPassword!');
        // await $('button[type="submit"]').click();

        // await expect($('#flash')).toBeExisting();
        // await expect($('#flash')).toHaveTextContaining(
        //     'You logged into a secure area!');
    });
});

